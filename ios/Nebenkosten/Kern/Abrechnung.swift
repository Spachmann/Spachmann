import Foundation

/// Abrechnungs-Engine.
///
/// Erzeugt aus den Stammdaten eine vollständige Betriebskostenabrechnung je
/// Mietverhältnis. Der Aufbau folgt den vier formellen Mindestangaben, die der
/// BGH in ständiger Rechtsprechung verlangt (u. a. BGH VIII ZR 84/07):
///
/// 1. Zusammenstellung der Gesamtkosten je Kostenart
/// 2. Angabe und Erläuterung des Verteilerschlüssels
/// 3. Berechnung des Anteils des Mieters
/// 4. Abzug der geleisteten Vorauszahlungen
///
/// Nicht umlagefähige Kosten werden vollständig vom Umlageteil getrennt und
/// ausschließlich in der internen Vermieterübersicht ausgewiesen.
enum Abrechnung {

    // MARK: - Nutzungsabschnitte

    /// Ein Abschnitt des Abrechnungszeitraums, in dem eine Einheit von genau
    /// einem Mieter genutzt wurde – oder leer stand.
    struct Nutzeinheit: Identifiable, Hashable {
        let id: String
        let einheitId: String
        let einheitBezeichnung: String
        let mietverhaeltnisId: String?
        let mieterName: String
        let leerstand: Bool
        let von: String
        let bis: String
        let tage: Int
        let wohnflaeche: Double
        let mea: Double
        let personen: Double
        var anteilAmEinheitsZeitraum: Double = 1

        func basiswert(_ schluessel: Schluessel) -> Double {
            switch schluessel {
            case .flaeche: return wohnflaeche
            case .personen: return personen
            case .einheiten: return 1
            case .mea: return mea
            default: return 0
            }
        }
    }

    /// Zerlegt den Abrechnungszeitraum je Einheit in Nutzungsabschnitte.
    /// Lücken zwischen Mietverhältnissen gelten als Leerstand; die darauf
    /// entfallenden Kosten trägt der Vermieter (§ 556 Abs. 1 BGB).
    static func bildeNutzeinheiten(_ bestand: Objektbestand, von: String, bis: String) -> [Nutzeinheit] {
        var ergebnis: [Nutzeinheit] = []
        guard let zeitraumStart = Datum.tagesnummer(von), let zeitraumEnde = Datum.tagesnummer(bis) else {
            return ergebnis
        }

        for einheit in bestand.einheiten {
            let abschnitte = bestand.mietverhaeltnisseZu(einheitId: einheit.id)
                .compactMap { mv -> (Mietverhaeltnis, (von: String, bis: String))? in
                    guard let schnitt = Datum.schnitt(mv.von, mv.ende(spaetestens: bis), von, bis) else { return nil }
                    return (mv, schnitt)
                }
                .sorted { (Datum.tagesnummer($0.1.von) ?? 0) < (Datum.tagesnummer($1.1.von) ?? 0) }

            var laufend = zeitraumStart

            for (mv, schnitt) in abschnitte {
                guard let start = Datum.tagesnummer(schnitt.von), let ende = Datum.tagesnummer(schnitt.bis) else { continue }
                if start > laufend {
                    ergebnis.append(nutzeinheit(einheit, nil, Datum.iso(laufend), Datum.iso(start - 1), bestand))
                }
                ergebnis.append(nutzeinheit(einheit, mv, schnitt.von, schnitt.bis, bestand))
                laufend = max(laufend, ende + 1)
            }

            if laufend <= zeitraumEnde {
                ergebnis.append(nutzeinheit(einheit, nil, Datum.iso(laufend), Datum.iso(zeitraumEnde), bestand))
            }
        }

        return mitZeitanteilen(ergebnis)
    }

    private static func nutzeinheit(
        _ einheit: Einheit,
        _ mietverhaeltnis: Mietverhaeltnis?,
        _ von: String,
        _ bis: String,
        _ bestand: Objektbestand
    ) -> Nutzeinheit {
        Nutzeinheit(
            id: "\(einheit.id):\(mietverhaeltnis?.id ?? "leer"):\(von)",
            einheitId: einheit.id,
            einheitBezeichnung: einheit.bezeichnung,
            mietverhaeltnisId: mietverhaeltnis?.id,
            mieterName: mietverhaeltnis?.mieterName ?? "Leerstand",
            leerstand: mietverhaeltnis == nil,
            von: von,
            bis: bis,
            tage: Datum.tage(von, bis),
            wohnflaeche: einheit.wohnflaeche,
            mea: einheit.mea,
            personen: mietverhaeltnis?.personen ?? bestand.objekt.leerstandPersonen)
    }

    /// Vermerkt, welcher Anteil des Einheits-Zeitraums auf jeden Abschnitt entfällt.
    private static func mitZeitanteilen(_ nutzeinheiten: [Nutzeinheit]) -> [Nutzeinheit] {
        var tageJeEinheit: [String: Int] = [:]
        for n in nutzeinheiten {
            tageJeEinheit[n.einheitId, default: 0] += n.tage
        }
        return nutzeinheiten.map { n in
            var kopie = n
            let gesamt = tageJeEinheit[n.einheitId] ?? 0
            kopie.anteilAmEinheitsZeitraum = gesamt > 0 ? Double(n.tage) / Double(gesamt) : 0
            return kopie
        }
    }

    // MARK: - Verteilung einer Position

    struct Anteil {
        var anteil: Double = 0
        var bezug: Double = 0
        var bezugTage: Int = 0
        var betrag: Cent = 0
    }

    struct Differenzinfo {
        var menge: Double
        var hauptzaehler: Double
        var topf: Cent
        var modus: Verbrauchsdifferenz
        var anteile: [String: Anteil]?
        var bezugGesamt: Double
    }

    struct Verteilung {
        var anteile: [String: Anteil] = [:]
        var bezugGesamt: Double = 0
        var bezugEinheit: String = ""
        var differenzInfo: Differenzinfo?
        var verteilbarerBetrag: Cent = 0
        var vermieterTraegt: Cent = 0
        var hinweise: [String] = []
    }

    /// Eine Position zusammen mit ihrer berechneten Verteilung.
    struct Positionsverteilung {
        let position: Position
        let verteilung: Verteilung
    }

    struct Verteilungskontext {
        var von: String
        var bis: String
        var verbraeuche: [Verbrauch]
        var hauptzaehler: Hauptzaehler
        var verbrauchsdifferenz: Verbrauchsdifferenz
    }

    static func verteile(_ position: Position, auf nutzeinheiten: [Nutzeinheit], kontext: Verteilungskontext) -> Verteilung {
        var verteilung = Verteilung()
        verteilung.verteilbarerBetrag = position.umlagebetrag

        let pVon = position.zeitraumVon.isEmpty ? kontext.von : position.zeitraumVon
        let pBis = position.zeitraumBis.isEmpty ? kontext.bis : position.zeitraumBis
        let umlagebetrag = position.umlagebetrag

        switch position.schluessel {
        case .direkt:
            let treffer = nutzeinheiten.filter { $0.einheitId == position.direktEinheitId }
            let gesamtTage = treffer.map { Datum.ueberschneidungTage($0.von, $0.bis, pVon, pBis) }.reduce(0, +)
            for n in treffer {
                let t = Datum.ueberschneidungTage(n.von, n.bis, pVon, pBis)
                let anteil = gesamtTage > 0 ? Double(t) / Double(gesamtTage) : 0
                verteilung.anteile[n.id] = Anteil(anteil: anteil, bezug: Double(t), bezugTage: t,
                                                  betrag: Geld.anteil(von: umlagebetrag, anteil))
            }
            if treffer.isEmpty {
                verteilung.hinweise.append("Der Position ist keine gültige Einheit zugeordnet.")
            }
            verteilung.bezugGesamt = Double(gesamtTage)
            verteilung.bezugEinheit = "Tage"

        case .verbrauchWasser:
            verteileVerbrauch(position, nutzeinheiten, kontext, umlagebetrag, into: &verteilung)

        default:
            let info = Katalog.info(position.schluessel)
            var gewichte: [(n: Nutzeinheit, gewicht: Double, tage: Int)] = []
            for n in nutzeinheiten {
                let t = Datum.ueberschneidungTage(n.von, n.bis, pVon, pBis)
                gewichte.append((n, n.basiswert(position.schluessel) * Double(t), t))
            }
            let gesamtGewicht = gewichte.map(\.gewicht).summe

            for eintrag in gewichte {
                let anteil = gesamtGewicht > 0 ? eintrag.gewicht / gesamtGewicht : 0
                verteilung.anteile[eintrag.n.id] = Anteil(
                    anteil: anteil,
                    bezug: eintrag.n.basiswert(position.schluessel),
                    bezugTage: eintrag.tage,
                    betrag: Geld.anteil(von: umlagebetrag, anteil))
            }

            if gesamtGewicht <= 0 {
                verteilung.hinweise.append("Bezugsgröße ist null – die Position kann nicht verteilt werden.")
            }

            // Bei durchgehend gleicher Belegung entspricht die Bezugsgröße der
            // reinen Summe der Basiswerte.
            let tageZeitraum = Datum.tage(pVon, pBis)
            verteilung.bezugGesamt = tageZeitraum > 0 ? gesamtGewicht / Double(tageZeitraum) : 0
            verteilung.bezugEinheit = info.einheit
        }

        return verteilung
    }

    private static func verteileVerbrauch(
        _ position: Position,
        _ nutzeinheiten: [Nutzeinheit],
        _ kontext: Verteilungskontext,
        _ umlagebetrag: Cent,
        into verteilung: inout Verteilung
    ) {
        let art = position.verbrauchsart
        let werte = nutzeinheiten.map { (n: $0, wert: verbrauchswert($0, kontext.verbraeuche, art)) }
        let summeEinheiten = werte.map(\.wert).summe
        let hauptzaehler = kontext.hauptzaehler.wert(art)
        let modus = kontext.verbrauchsdifferenz

        verteilung.bezugEinheit = "m³"

        guard summeEinheiten > 0 else {
            verteilung.hinweise.append(
                "Für diese Position sind keine Verbrauchswerte erfasst. Bei vorhandener Verbrauchserfassung ist verbrauchsabhängig abzurechnen (§ 556a Abs. 1 Satz 2 BGB).")
            verteilung.bezugGesamt = 0
            verteilung.verteilbarerBetrag = umlagebetrag
            return
        }

        let differenz = hauptzaehler > summeEinheiten ? hauptzaehler - summeEinheiten : 0
        var verbrauchsTopf = umlagebetrag
        var differenzTopf: Cent = 0

        if differenz > 0 && modus != .verbrauch {
            verbrauchsTopf = Geld.anteil(von: umlagebetrag, summeEinheiten / hauptzaehler)
            differenzTopf = umlagebetrag - verbrauchsTopf
        }

        for eintrag in werte {
            let anteil = eintrag.wert / summeEinheiten
            verteilung.anteile[eintrag.n.id] = Anteil(
                anteil: anteil,
                bezug: eintrag.wert,
                bezugTage: eintrag.n.tage,
                betrag: Geld.anteil(von: verbrauchsTopf, anteil))
        }

        // Die Differenzmenge wird als eigene Zeile ausgewiesen. Nur so bleibt
        // die Rechnung „Ihr Maßstab ÷ Gesamtmaßstab = Ihr Anteil" für den
        // Mieter nachprüfbar.
        if differenzTopf > 0 {
            var info = Differenzinfo(menge: differenz, hauptzaehler: hauptzaehler, topf: differenzTopf,
                                     modus: modus, anteile: nil, bezugGesamt: 0)
            if modus == .flaeche {
                let gewichte = nutzeinheiten.map { (n: $0, gewicht: $0.wohnflaeche * Double($0.tage)) }
                let gesamtGewicht = gewichte.map(\.gewicht).summe
                let tageZeitraum = Datum.tage(kontext.von, kontext.bis)
                var differenzAnteile: [String: Anteil] = [:]
                for eintrag in gewichte {
                    let anteil = gesamtGewicht > 0 ? eintrag.gewicht / gesamtGewicht : 0
                    differenzAnteile[eintrag.n.id] = Anteil(
                        anteil: anteil,
                        bezug: eintrag.n.wohnflaeche,
                        bezugTage: eintrag.n.tage,
                        betrag: Geld.anteil(von: differenzTopf, anteil))
                }
                info.anteile = differenzAnteile
                info.bezugGesamt = tageZeitraum > 0 ? gesamtGewicht / Double(tageZeitraum) : 0
            }
            verteilung.differenzInfo = info
        }

        if differenz > 0 && modus == .verbrauch {
            verteilung.hinweise.append(
                "Der Hauptzähler weist \(Geld.zahl(differenz, 1)) m³ mehr aus als die Summe der Wohnungszähler. Die Differenz wird anteilig auf alle erfassten Verbräuche umgelegt.")
        }

        verteilung.bezugGesamt = summeEinheiten
        verteilung.verteilbarerBetrag = verbrauchsTopf
        verteilung.vermieterTraegt = modus == .vermieter ? differenzTopf : 0
    }

    /// Verbrauchswert einer Nutzeinheit aus den erfassten Zählerständen.
    private static func verbrauchswert(_ n: Nutzeinheit, _ verbraeuche: [Verbrauch], _ art: Verbrauchsart) -> Double {
        if let genau = verbraeuche.first(where: {
            $0.art == art && $0.einheitId == n.einheitId && $0.mietverhaeltnisId == n.mietverhaeltnisId
        }) {
            return genau.wert
        }
        // Ohne Zwischenablesung wird der Einheitsverbrauch zeitanteilig geteilt.
        guard let proEinheit = verbraeuche.first(where: {
            $0.art == art && $0.einheitId == n.einheitId && $0.mietverhaeltnisId == nil
        }) else { return 0 }
        return proEinheit.wert * n.anteilAmEinheitsZeitraum
    }

    // MARK: - Ergebnisstrukturen

    struct Posten: Identifiable, Hashable {
        var id: String
        var kostenartId: String
        var nr: Int?
        var bezeichnung: String
        var rechtsgrundlage: String
        var gesamtkosten: Cent
        var gesamtkostenBrutto: Cent
        var abzug: Cent
        var abzugGrund: String
        var schluessel: Schluessel
        var bezugGesamt: Double
        var bezugEinheit: String
        var bezugAnteil: Double
        var bezugTage: Int
        var anteil: Double
        var betrag: Cent
        var zeitraumVon: String
        var zeitraumBis: String
        var erlaeuterung: String?

        var schluesseltext: String { Katalog.info(schluessel).kurz }

        static func == (links: Posten, rechts: Posten) -> Bool { links.id == rechts.id && links.betrag == rechts.betrag }
        func hash(into hasher: inout Hasher) { hasher.combine(id) }
    }

    struct Vorauszahlungen {
        var modus: Vorauszahlungsmodus = .monatlich
        var monate: Int = 0
        var betriebskosten: Cent = 0
        var heizkosten: Cent = 0
        var gesamt: Cent { betriebskosten + heizkosten }
        var monatsbetrag: Cent { monate > 0 ? gesamt / monate : 0 }
    }

    struct Paragraph35a {
        var haushaltsnah: Cent = 0
        var handwerker: Cent = 0
        var gesamt: Cent { haushaltsnah + handwerker }
    }

    struct Mieterergebnis: Identifiable {
        var id: String { mietverhaeltnisId }
        var mietverhaeltnisId: String
        var mieterName: String
        var mieterAnschrift: String
        var einheit: Einheit?
        var nutzungVon: String
        var nutzungBis: String
        var nutzungTage: Int
        var personen: Double
        var abschnitte: [Nutzeinheit]
        var posten: [Posten]
        var heizzeilen: [Heizkosten.Zeile]
        var heizsumme: Cent
        var kuerzung15: Cent
        var summeBetriebskosten: Cent
        var summeGesamt: Cent
        var vorauszahlungen: Vorauszahlungen
        var saldo: Cent
        var paragraph35a: Paragraph35a

        var nachzahlung: Cent { saldo > 0 ? saldo : 0 }
        var guthaben: Cent { saldo < 0 ? -saldo : 0 }
    }

    struct Vermieteranteile {
        var leerstandsanteil: Cent = 0
        var nichtUmlagefaehig: Cent = 0
        var abzuege: Cent = 0
        var co2Anteil: Cent = 0
        var verbrauchsdifferenz: Cent = 0
        var kuerzung15: Cent = 0
        var rundungsdifferenz: Cent = 0
        var gesamtbelastung: Cent = 0
    }

    struct Summen {
        var umlagefaehig: Cent = 0
        var nichtUmlagefaehig: Cent = 0
        var gesamtkosten: Cent = 0
        var aufMieterUmgelegt: Cent = 0
    }

    struct Ergebnis {
        var von: String = ""
        var bis: String = ""
        var jahr: Int = 0
        var tageZeitraum: Int = 0
        var nutzeinheiten: [Nutzeinheit] = []
        var verteilungen: [Positionsverteilung] = []
        var heizung: Heizkosten.Ergebnis?
        var positionenUmlagefaehig: [Position] = []
        var positionenNichtUmlagefaehig: [Position] = []
        var ergebnisse: [Mieterergebnis] = []
        var vermieter = Vermieteranteile()
        var summen = Summen()
    }

    // MARK: - Hauptberechnung

    static func berechne(_ bestand: Objektbestand, _ periode: Abrechnungszeitraum) -> Ergebnis {
        var ergebnis = Ergebnis()
        ergebnis.von = periode.von
        ergebnis.bis = periode.bis
        ergebnis.jahr = periode.jahr
        ergebnis.tageZeitraum = Datum.tage(periode.von, periode.bis)

        let nutzeinheiten = bildeNutzeinheiten(bestand, von: periode.von, bis: periode.bis)
        ergebnis.nutzeinheiten = nutzeinheiten

        let kontext = Verteilungskontext(
            von: periode.von,
            bis: periode.bis,
            verbraeuche: periode.verbraeuche,
            hauptzaehler: periode.hauptzaehler,
            verbrauchsdifferenz: bestand.objekt.verbrauchsdifferenz)

        let umlagefaehige = periode.positionen.filter(\.istUmlagefaehig)
        let nichtUmlagefaehige = periode.positionen.filter { !$0.istUmlagefaehig }
        ergebnis.positionenUmlagefaehig = umlagefaehige
        ergebnis.positionenNichtUmlagefaehig = nichtUmlagefaehige

        // --- Heizkosten nach HeizkostenV ---
        var heizergebnis: Heizkosten.Ergebnis?
        if periode.heizung.aktiv {
            let h = periode.heizung
            var eingaben = Heizkosten.Eingaben()
            eingaben.kosten = h.kosten
            eingaben.co2Kosten = h.co2.kostenCent
            eingaben.co2EmissionKg = h.co2.emissionKg
            eingaben.gebaeudetyp = h.co2.gebaeudetyp
            eingaben.co2Ausnahme = h.co2.ausnahme
            eingaben.verbunden = h.verbunden
            eingaben.kostenWarmwasserSeparat = h.kostenWarmwasserSeparat
            eingaben.warmwasser = Heizkosten.Warmwassereingaben(
                methode: h.warmwasser.modus,
                warmwasserKwh: h.warmwasser.warmwasserKwh,
                volumen: h.warmwasser.volumen,
                temperatur: h.warmwasser.temperatur,
                prozentsatz: h.warmwasser.prozentsatz,
                gesamtwaermeKwh: h.gesamtwaermeKwh,
                brennstoffmenge: h.brennstoffmenge,
                brennstoff: h.brennstoff)
            eingaben.anteilVerbrauchHeizung = h.anteilVerbrauchHeizung
            eingaben.anteilVerbrauchWarmwasser = h.anteilVerbrauchWarmwasser
            eingaben.verbrauchserfassung = h.verbrauchserfassung
            eingaben.tageZeitraum = ergebnis.tageZeitraum
            eingaben.wohnflaecheGesamt = bestand.massgeblicheWohnflaeche
            eingaben.nutzer = nutzeinheiten.map { n in
                Heizkosten.Nutzer(
                    id: n.id,
                    bezeichnung: "\(n.einheitBezeichnung) – \(n.mieterName)",
                    leerstand: n.leerstand,
                    flaecheTage: n.wohnflaeche * Double(n.tage),
                    verbrauchHeizung: verbrauchswert(n, periode.verbraeuche, .heizung),
                    verbrauchWarmwasser: verbrauchswert(n, periode.verbraeuche, .warmwasser))
            }
            heizergebnis = Heizkosten.berechne(eingaben)
        }
        ergebnis.heizung = heizergebnis

        // --- Verteilung der laufenden Betriebskosten ---
        let verteilungen = umlagefaehige.map {
            Positionsverteilung(position: $0, verteilung: verteile($0, auf: nutzeinheiten, kontext: kontext))
        }
        ergebnis.verteilungen = verteilungen

        // --- Ergebnis je Nutzungsabschnitt ---
        struct Sammler {
            var posten: [Posten] = []
            var heizzeile: Heizkosten.Zeile?
            var summe: Cent = 0
            var lohnHaushaltsnah: Cent = 0
            var lohnHandwerker: Cent = 0
        }
        var jeAbschnitt: [String: Sammler] = [:]
        for n in nutzeinheiten { jeAbschnitt[n.id] = Sammler() }

        for eintrag in verteilungen {
            let position = eintrag.position
            let verteilung = eintrag.verteilung
            let art = position.art
            let umlagebetrag = position.umlagebetrag

            for n in nutzeinheiten {
                guard let anteil = verteilung.anteile[n.id], anteil.betrag != 0 else { continue }
                let quote = umlagebetrag > 0 ? Double(anteil.betrag) / Double(umlagebetrag) : 0

                jeAbschnitt[n.id, default: Sammler()].posten.append(Posten(
                    id: position.id,
                    kostenartId: position.kostenartId,
                    nr: art?.nr,
                    bezeichnung: position.anzeigename,
                    rechtsgrundlage: art?.rechtsgrundlage ?? "",
                    gesamtkosten: verteilung.verteilbarerBetrag,
                    gesamtkostenBrutto: position.betragBrutto,
                    abzug: position.abzugBetrag,
                    abzugGrund: position.abzugGrund,
                    schluessel: position.schluessel,
                    bezugGesamt: verteilung.bezugGesamt,
                    bezugEinheit: verteilung.bezugEinheit,
                    bezugAnteil: anteil.bezug,
                    bezugTage: anteil.bezugTage,
                    anteil: anteil.anteil,
                    betrag: anteil.betrag,
                    zeitraumVon: position.zeitraumVon.isEmpty ? periode.von : position.zeitraumVon,
                    zeitraumBis: position.zeitraumBis.isEmpty ? periode.bis : position.zeitraumBis,
                    erlaeuterung: nil))

                jeAbschnitt[n.id, default: Sammler()].summe += anteil.betrag
                jeAbschnitt[n.id, default: Sammler()].lohnHaushaltsnah += Geld.runde(Double(position.lohnanteilHaushaltsnah) * quote)
                jeAbschnitt[n.id, default: Sammler()].lohnHandwerker += Geld.runde(Double(position.lohnanteilHandwerker) * quote)
            }

            // Zählerdifferenz als eigene, nachprüfbare Zeile
            if let differenz = verteilung.differenzInfo, let differenzAnteile = differenz.anteile {
                let flaecheninfo = Katalog.info(.flaeche)
                let gemessen = differenz.hauptzaehler - differenz.menge
                for n in nutzeinheiten {
                    guard let anteil = differenzAnteile[n.id], anteil.betrag != 0 else { continue }
                    jeAbschnitt[n.id, default: Sammler()].posten.append(Posten(
                        id: "\(position.id):differenz",
                        kostenartId: position.kostenartId,
                        nr: art?.nr,
                        bezeichnung: "\(position.anzeigename) – Allgemein- und Schwundwasser",
                        rechtsgrundlage: art?.rechtsgrundlage ?? "",
                        gesamtkosten: differenz.topf,
                        gesamtkostenBrutto: differenz.topf,
                        abzug: 0,
                        abzugGrund: "",
                        schluessel: .flaeche,
                        bezugGesamt: differenz.bezugGesamt,
                        bezugEinheit: flaecheninfo.einheit,
                        bezugAnteil: anteil.bezug,
                        bezugTage: anteil.bezugTage,
                        anteil: anteil.anteil,
                        betrag: anteil.betrag,
                        zeitraumVon: position.zeitraumVon.isEmpty ? periode.von : position.zeitraumVon,
                        zeitraumBis: position.zeitraumBis.isEmpty ? periode.bis : position.zeitraumBis,
                        erlaeuterung: "Hauptzähler \(Geld.zahl(differenz.hauptzaehler, 1)) m³ ./. Wohnungszähler \(Geld.zahl(gemessen, 1)) m³ = \(Geld.zahl(differenz.menge, 1)) m³, nach Wohnfläche verteilt"))
                    jeAbschnitt[n.id, default: Sammler()].summe += anteil.betrag
                }
            }
        }

        if let heiz = heizergebnis {
            for zeile in heiz.zeilen {
                jeAbschnitt[zeile.id, default: Sammler()].heizzeile = zeile
                jeAbschnitt[zeile.id, default: Sammler()].summe += zeile.summe
            }
        }

        // --- Je Mietverhältnis aggregieren ---
        var mieterergebnisse: [Mieterergebnis] = []
        for mv in bestand.mietverhaeltnisse {
            let abschnitte = nutzeinheiten.filter { $0.mietverhaeltnisId == mv.id }
            guard !abschnitte.isEmpty else { continue }

            var posten: [Posten] = []
            var heizzeilen: [Heizkosten.Zeile] = []
            var heizsumme: Cent = 0
            var kuerzung: Cent = 0
            var lohn = Paragraph35a()

            for abschnitt in abschnitte {
                guard let sammler = jeAbschnitt[abschnitt.id] else { continue }
                for p in sammler.posten {
                    if let index = posten.firstIndex(where: { $0.id == p.id }) {
                        // Mehrere Abschnitte desselben Mietverhältnisses zusammenführen:
                        // Verbrauchswerte addieren sich, Flächenmaßstäbe nicht.
                        posten[index].betrag += p.betrag
                        posten[index].bezugTage += p.bezugTage
                        posten[index].anteil += p.anteil
                        if p.schluessel == .verbrauchWasser || p.schluessel == .direkt {
                            posten[index].bezugAnteil += p.bezugAnteil
                        }
                    } else {
                        posten.append(p)
                    }
                }
                if let zeile = sammler.heizzeile {
                    heizzeilen.append(zeile)
                    heizsumme += zeile.summe
                    kuerzung += zeile.kuerzung15
                }
                lohn.haushaltsnah += sammler.lohnHaushaltsnah
                lohn.handwerker += sammler.lohnHandwerker
            }

            posten.sort { ($0.nr ?? 99) < ($1.nr ?? 99) }

            let summeBetriebskosten = posten.map(\.betrag).summe
            let summeGesamt = summeBetriebskosten + heizsumme
            let nutzungVon = abschnitte.first?.von ?? periode.von
            let nutzungBis = abschnitte.last?.bis ?? periode.bis
            let vorauszahlungen = berechneVorauszahlungen(mv, von: nutzungVon, bis: nutzungBis)

            mieterergebnisse.append(Mieterergebnis(
                mietverhaeltnisId: mv.id,
                mieterName: mv.mieterName,
                mieterAnschrift: mv.mieterAnschrift,
                einheit: bestand.einheit(mv.einheitId),
                nutzungVon: nutzungVon,
                nutzungBis: nutzungBis,
                nutzungTage: abschnitte.map(\.tage).reduce(0, +),
                personen: abschnitte.first?.personen ?? 0,
                abschnitte: abschnitte,
                posten: posten,
                heizzeilen: heizzeilen,
                heizsumme: heizsumme,
                kuerzung15: kuerzung,
                summeBetriebskosten: summeBetriebskosten,
                summeGesamt: summeGesamt,
                vorauszahlungen: vorauszahlungen,
                saldo: summeGesamt - vorauszahlungen.gesamt,
                paragraph35a: lohn))
        }

        mieterergebnisse.sort {
            ($0.einheit?.bezeichnung ?? "").localizedStandardCompare($1.einheit?.bezeichnung ?? "") == .orderedAscending
        }
        ergebnis.ergebnisse = mieterergebnisse

        // --- Vermieterseitige Übersicht ---
        var vermieter = Vermieteranteile()
        vermieter.leerstandsanteil = nutzeinheiten
            .filter(\.leerstand)
            .compactMap { jeAbschnitt[$0.id]?.summe }
            .summe
        vermieter.nichtUmlagefaehig = nichtUmlagefaehige.map(\.betragBrutto).summe
        vermieter.abzuege = umlagefaehige.map(\.abzugBetrag).summe
        vermieter.co2Anteil = heizergebnis?.co2.vermieterCent ?? 0
        vermieter.verbrauchsdifferenz = verteilungen.map { $0.verteilung.vermieterTraegt }.summe
        vermieter.kuerzung15 = mieterergebnisse.map(\.kuerzung15).summe

        let summeUmlagefaehigGesamt = umlagefaehige.map(\.umlagebetrag).summe + (heizergebnis?.gesamtUmlagefaehig ?? 0)
        let summeAufMieter = mieterergebnisse.map(\.summeGesamt).summe

        vermieter.rundungsdifferenz = summeUmlagefaehigGesamt
            - summeAufMieter
            - vermieter.leerstandsanteil
            - vermieter.verbrauchsdifferenz
        vermieter.gesamtbelastung = vermieter.nichtUmlagefaehig
            + vermieter.abzuege
            + vermieter.leerstandsanteil
            + vermieter.verbrauchsdifferenz
            + vermieter.co2Anteil
        ergebnis.vermieter = vermieter

        var summen = Summen()
        summen.umlagefaehig = summeUmlagefaehigGesamt
        summen.nichtUmlagefaehig = vermieter.nichtUmlagefaehig + vermieter.abzuege
        summen.gesamtkosten = periode.positionen.map(\.betragBrutto).summe + (heizergebnis?.kostenGesamtRoh ?? 0)
        summen.aufMieterUmgelegt = summeAufMieter
        ergebnis.summen = summen

        return ergebnis
    }

    /// Vorauszahlungen des Mieters im Nutzungszeitraum.
    static func berechneVorauszahlungen(_ mv: Mietverhaeltnis, von: String, bis: String) -> Vorauszahlungen {
        var ergebnis = Vorauszahlungen()
        ergebnis.modus = mv.vzModus
        ergebnis.monate = Datum.monateImZeitraum(von, bis)

        switch mv.vzModus {
        case .gesamt:
            ergebnis.betriebskosten = mv.vzGesamtBetriebskosten
            ergebnis.heizkosten = mv.vzGesamtHeizkosten
        case .monatlich:
            ergebnis.betriebskosten = mv.vzBetriebskostenMonat * ergebnis.monate
            ergebnis.heizkosten = mv.vzHeizkostenMonat * ergebnis.monate
        }
        return ergebnis
    }
}
