import Foundation

/// Erzeugt das Abrechnungsdokument als HTML.
///
/// Das HTML dient zugleich der Bildschirmvorschau und als Vorlage für den
/// PDF-Druck im A4-Format. Der Aufbau bildet die vom BGH geforderten formellen
/// Mindestangaben ab und ergänzt sie um Erläuterung der Verteilerschlüssel,
/// Bescheinigung nach § 35a EStG sowie Hinweise auf Belegeinsicht und
/// Einwendungsfrist.
///
/// Die Erzeugung kommt ohne UIKit aus und ist damit unmittelbar testbar.
enum DokumentHTML {

    // MARK: - Einstiegspunkte

    /// Vollständige HTML-Seite mit allen Mieterabrechnungen.
    static func alleMieterdokumente(_ bestand: Objektbestand, _ periode: Abrechnungszeitraum, _ ergebnis: Abrechnung.Ergebnis) -> String {
        seite(ergebnis.ergebnisse.map { mieterinhalt(bestand, periode, ergebnis, $0) }.joined(separator: "\n"))
    }

    /// Vollständige HTML-Seite mit der Abrechnung eines Mietverhältnisses.
    static func mieterdokument(_ bestand: Objektbestand, _ periode: Abrechnungszeitraum, _ ergebnis: Abrechnung.Ergebnis, _ mieter: Abrechnung.Mieterergebnis) -> String {
        seite(mieterinhalt(bestand, periode, ergebnis, mieter))
    }

    /// Vollständige HTML-Seite mit der internen Kostenübersicht des Vermieters.
    static func vermieteruebersicht(_ bestand: Objektbestand, _ periode: Abrechnungszeitraum, _ ergebnis: Abrechnung.Ergebnis) -> String {
        seite(vermieterinhalt(bestand, periode, ergebnis))
    }

    // MARK: - Seitengerüst

    static func seite(_ inhalt: String) -> String {
        """
        <!doctype html>
        <html lang="de"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Betriebskostenabrechnung</title>
        <style>\(stilvorlage)</style>
        </head><body>
        \(inhalt)
        </body></html>
        """
    }

    static let stilvorlage = """
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      color: #000;
      font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 10.2pt;
      line-height: 1.42;
      -webkit-text-size-adjust: 100%;
    }
    .blatt { padding: 15mm 14mm 12mm; }
    .blatt + .blatt { border-top: 1px dashed #bbb; break-before: page; page-break-before: always; }

    h1 { font-size: 15pt; margin: 0 0 3mm; letter-spacing: -.01em; }
    h2 { font-size: 11pt; margin: 7mm 0 2.5mm; padding-bottom: 1.2mm; border-bottom: 1px solid #000;
         break-after: avoid; page-break-after: avoid; }
    h3 { font-size: 10pt; margin: 4mm 0 1.5mm; }
    p { margin: 0 0 2mm; }

    .absender { font-size: 7.5pt; color: #333; border-bottom: .4pt solid #999; padding-bottom: 1mm; margin-bottom: 3mm; }
    .kopf { display: flex; gap: 8mm; margin-bottom: 8mm; }
    .anschrift { width: 85mm; min-height: 30mm; }
    .anschrift .zeile { display: block; }
    .meta { margin-left: auto; font-size: 9pt; text-align: right; }
    .meta .zeile { display: flex; gap: 4mm; justify-content: flex-end; }
    .meta .zeile span:first-child { color: #444; }

    .objektkasten { background: #f2f3f5; border: .4pt solid #b8bcc2; padding: 3mm 4mm; margin-bottom: 5mm; font-size: 9.2pt;
                    break-inside: avoid; page-break-inside: avoid; }
    .objektkasten dl { display: grid; grid-template-columns: 42mm 1fr; gap: .8mm 3mm; margin: 0; }
    .objektkasten dt { color: #444; }
    .objektkasten dd { margin: 0; font-weight: 600; }

    table { width: 100%; border-collapse: collapse; font-size: 8.8pt; margin-bottom: 3mm; overflow-wrap: break-word; }
    table.fest { table-layout: fixed; }
    th { text-align: left; font-weight: 700; font-size: 6.9pt; text-transform: uppercase; letter-spacing: .01em;
         line-height: 1.25; border-bottom: .8pt solid #000; padding: 1.6mm 2mm; vertical-align: bottom; }
    table.fest th { overflow-wrap: normal; }
    td { padding: 1.5mm 2mm; border-bottom: .3pt solid #ccc; vertical-align: top; }
    td.z { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    th.z { text-align: right; white-space: normal; }
    tr.summe td { font-weight: 700; border-top: .8pt solid #000; border-bottom: 0; padding-top: 2mm; }
    tr.zwischensumme td { font-weight: 600; border-top: .4pt solid #666; background: #f6f7f8; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    thead { display: table-header-group; }
    .klein { font-size: 7.4pt; color: #444; display: block; margin-top: .5mm; }

    .saldo { border: 1.2pt solid #000; padding: 4mm; margin: 5mm 0; break-inside: avoid; page-break-inside: avoid; }
    .saldo table { margin: 0; font-size: 9.6pt; }
    .saldo td { padding: 1.4mm 0; border: 0; }
    .saldo tr.ergebnis td { font-size: 12pt; font-weight: 700; border-top: 1pt solid #000; padding-top: 2.5mm; }

    .kasten { border: .5pt solid #999; padding: 3mm 4mm; margin: 4mm 0; font-size: 8.6pt; background: #fafafa;
              break-inside: avoid; page-break-inside: avoid; }
    .kasten h3 { margin-top: 0; }
    .kasten ul { margin: 0; padding-left: 4.5mm; }
    .kasten li { margin-bottom: 1.2mm; }
    .kasten table { font-size: 8.8pt; margin: 2mm 0 0; }
    .kasten td { border: 0; padding: 1mm 0; }
    .kasten tr.summenzeile td { border-top: .5pt solid #666; font-weight: 700; }

    .fuss { margin-top: 6mm; padding-top: 2.5mm; border-top: .4pt solid #999; font-size: 7.4pt; color: #444; line-height: 1.4; }
    .unterschrift { margin-top: 10mm; font-size: 9pt; }
    .unterschrift .linie { border-bottom: .5pt solid #000; width: 70mm; margin-top: 12mm; padding-bottom: 1mm; }
    .warnung { color: #a00; font-weight: 700; }
    """

    // MARK: - Mieterabrechnung

    static func mieterinhalt(
        _ bestand: Objektbestand,
        _ periode: Abrechnungszeitraum,
        _ ergebnis: Abrechnung.Ergebnis,
        _ mieter: Abrechnung.Mieterergebnis
    ) -> String {
        let datum = periode.erstelltAm.isEmpty ? Datum.heute() : periode.erstelltAm
        let heizungAbschnitt = ergebnis.heizung != nil ? heizkostenabschnitt(periode, ergebnis, mieter) : ""
        let ergebnisNummer = ergebnis.heizung != nil ? "3" : "2"

        return """
        <div class="blatt">
        \(kopfbereich(bestand, mieter, datum))

        <h1>Betriebskostenabrechnung \(periode.jahr)</h1>
        <p>Sehr geehrte Damen und Herren,<br>
        nachstehend erhalten Sie die Abrechnung über die Betriebs- und Heizkosten für den
        Abrechnungszeitraum vom \(Datum.deutsch(periode.von)) bis \(Datum.deutsch(periode.bis)).</p>

        \(objektkasten(bestand, ergebnis, mieter))

        <h2>1. Gesamtkosten, Verteilerschlüssel und Ihr Anteil</h2>
        \(betriebskostentabelle(ergebnis, mieter))

        \(heizungAbschnitt)

        <h2>\(ergebnisNummer). Abrechnungsergebnis</h2>
        \(saldokasten(periode, mieter, datum))

        \(paragraph35aKasten(mieter))

        \(schluesselerlaeuterung(ergebnis, mieter))

        \(hinweiskasten(periode, datum))

        <div class="unterschrift">
          <p>Mit freundlichen Grüßen</p>
          <div class="linie"></div>
          <div>\(esc(bestand.vermieter.anzeigename))</div>
        </div>

        \(fussnote)
        </div>
        """
    }

    private static func kopfbereich(_ bestand: Objektbestand, _ mieter: Abrechnung.Mieterergebnis, _ datum: String) -> String {
        let v = bestand.vermieter
        let zeilen = mieter.mieterAnschrift
            .components(separatedBy: CharacterSet(charactersIn: ",\n"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .map { "<span class=\"zeile\">\(esc($0))</span>" }
            .joined()

        var meta = """
        <div class="zeile"><span>Datum</span><span>\(Datum.deutsch(datum))</span></div>
        <div class="zeile"><span>Objekt</span><span>\(esc(bestand.objekt.bezeichnung.isEmpty ? bestand.objekt.strasse : bestand.objekt.bezeichnung))</span></div>
        <div class="zeile"><span>Einheit</span><span>\(esc(mieter.einheit?.bezeichnung ?? ""))</span></div>
        """
        if !v.telefon.isEmpty {
            meta += "<div class=\"zeile\"><span>Telefon</span><span>\(esc(v.telefon))</span></div>"
        }
        if !v.email.isEmpty {
            meta += "<div class=\"zeile\"><span>E-Mail</span><span>\(esc(v.email))</span></div>"
        }

        return """
        <div class="absender">\(esc(v.anschriftszeile))</div>
        <div class="kopf">
          <div class="anschrift">
            <span class="zeile"><strong>\(esc(mieter.mieterName))</strong></span>
            \(zeilen)
          </div>
          <div class="meta">\(meta)</div>
        </div>
        """
    }

    private static func objektkasten(_ bestand: Objektbestand, _ ergebnis: Abrechnung.Ergebnis, _ mieter: Abrechnung.Mieterergebnis) -> String {
        let teilzeitraum = mieter.nutzungTage != ergebnis.tageZeitraum
        let lage = mieter.einheit?.lage ?? ""
        let einheitText = esc(mieter.einheit?.bezeichnung ?? "") + (lage.isEmpty ? "" : " (\(esc(lage)))")

        return """
        <div class="objektkasten">
          <dl>
            <dt>Abrechnungsobjekt</dt><dd>\(esc(bestand.objekt.anschrift))</dd>
            <dt>Ihre Wohneinheit</dt><dd>\(einheitText)</dd>
            <dt>Wohnfläche der Einheit</dt><dd>\(Geld.zahl(mieter.einheit?.wohnflaeche ?? 0)) m²</dd>
            <dt>Gesamtwohnfläche</dt><dd>\(Geld.zahl(bestand.massgeblicheWohnflaeche)) m²</dd>
            <dt>Abrechnungszeitraum</dt><dd>\(Datum.deutsch(ergebnis.von)) – \(Datum.deutsch(ergebnis.bis)) (\(ergebnis.tageZeitraum) Tage)</dd>
            <dt>Ihr Nutzungszeitraum</dt><dd>\(Datum.deutsch(mieter.nutzungVon)) – \(Datum.deutsch(mieter.nutzungBis)) (\(mieter.nutzungTage) Tage)\(teilzeitraum ? " – zeitanteilige Abrechnung" : "")</dd>
            <dt>Personen im Haushalt</dt><dd>\(Geld.zahl(mieter.personen, 0))</dd>
          </dl>
        </div>
        """
    }

    private static func betriebskostentabelle(_ ergebnis: Abrechnung.Ergebnis, _ mieter: Abrechnung.Mieterergebnis) -> String {
        guard !mieter.posten.isEmpty else {
            return "<p><em>Für Ihren Nutzungszeitraum sind keine umlagefähigen Betriebskosten angefallen.</em></p>"
        }

        let zeilen = mieter.posten.map { p -> String in
            let info = Katalog.info(p.schluessel)
            let zeitraumTage = Datum.tage(p.zeitraumVon, p.zeitraumBis)
            var zusatz = ""
            if info.zeitanteilig, p.bezugTage > 0, p.bezugTage != ergebnis.tageZeitraum {
                zusatz = "<span class=\"klein\">zeitanteilig \(p.bezugTage) von \(zeitraumTage) Tagen</span>"
            }
            var abzug = ""
            if p.abzug > 0 {
                let grund = p.abzugGrund.isEmpty ? "" : ": \(esc(p.abzugGrund))"
                abzug = "<span class=\"klein\">Gesamtrechnung \(Geld.euro(p.gesamtkostenBrutto)), davon \(Geld.euro(p.abzug)) nicht umlagefähig\(grund)</span>"
            }
            let erlaeuterung = p.erlaeuterung.map { "<span class=\"klein\">\(esc($0))</span>" } ?? ""
            let nummer = p.nr.map { "<strong>\($0).</strong> " } ?? ""

            return """
            <tr>
              <td>\(nummer)\(esc(p.bezeichnung))<span class="klein">\(esc(p.rechtsgrundlage))</span>\(abzug)\(erlaeuterung)</td>
              <td class="z">\(Geld.euro(p.gesamtkosten))</td>
              <td>\(esc(info.kurz))\(zusatz)</td>
              <td class="z">\(bezugstext(p, gesamt: true))</td>
              <td class="z">\(bezugstext(p, gesamt: false))</td>
              <td class="z">\(Geld.prozent(p.anteil))</td>
              <td class="z"><strong>\(Geld.euro(p.betrag))</strong></td>
            </tr>
            """
        }.joined(separator: "\n")

        return """
        <table class="fest">
          <colgroup>
            <col style="width:32%"><col style="width:12%"><col style="width:14%">
            <col style="width:13%"><col style="width:11%"><col style="width:7%"><col style="width:11%">
          </colgroup>
          <thead>
            <tr>
              <th>Kostenart</th><th class="z">Gesamtkosten</th><th>Schlüssel</th>
              <th class="z">Maßstab gesamt</th><th class="z">Ihr Maßstab</th>
              <th class="z">Anteil</th><th class="z">Ihr Betrag</th>
            </tr>
          </thead>
          <tbody>\(zeilen)</tbody>
          <tfoot>
            <tr class="summe">
              <td colspan="6">Summe der umlagefähigen Betriebskosten</td>
              <td class="z">\(Geld.euro(mieter.summeBetriebskosten))</td>
            </tr>
          </tfoot>
        </table>
        """
    }

    private static func bezugstext(_ p: Abrechnung.Posten, gesamt: Bool) -> String {
        let wert = gesamt ? p.bezugGesamt : p.bezugAnteil
        switch p.schluessel {
        case .einheiten:
            return gesamt ? "\(Geld.zahl(wert, 0)) Einh." : "1 Einh."
        case .direkt:
            return gesamt ? "–" : "direkt"
        default:
            let einheit = p.bezugEinheit.isEmpty ? "" : " \(p.bezugEinheit)"
            return Geld.zahl(wert, p.schluessel == .personen ? 1 : 2) + einheit
        }
    }

    // MARK: - Heizkosten

    private static func heizkostenabschnitt(
        _ periode: Abrechnungszeitraum,
        _ ergebnis: Abrechnung.Ergebnis,
        _ mieter: Abrechnung.Mieterergebnis
    ) -> String {
        guard let h = ergebnis.heizung, !mieter.heizzeilen.isEmpty else { return "" }

        let zeilen = mieter.heizzeilen
        let tage = Double(max(1, ergebnis.tageZeitraum))
        let flaecheMieter = zeilen.map(\.flaecheTage).summe / tage
        let flaecheGesamt = h.bezug.flaecheTageGesamt / tage

        func kostenzeile(_ text: String, _ betrag: Cent) -> String {
            betrag == 0 ? "" : "<tr><td>\(esc(text))</td><td class=\"z\">\(Geld.euro(betrag))</td></tr>"
        }

        var co2Zeile = ""
        if h.co2.vermieterCent > 0, let stufe = h.co2.stufe {
            co2Zeile = """
            <tr><td>./. vom Vermieter zu tragender CO₂-Kostenanteil – Emissionskennwert \(Geld.zahl(h.co2.kgProM2, 1)) kg CO₂/m²·a, \
            Stufe \(stufe.nummer), Vermieteranteil \(Geld.zahl(h.co2.anteilVermieter * 100, 0)) % (§§ 5–7 CO2KostAufG)</td>\
            <td class="z">− \(Geld.euro(h.co2.vermieterCent))</td></tr>
            """
        }

        var aufteilungszeilen = ""
        if h.verbunden {
            var messtext = esc(h.warmwasserAufteilung.methode)
            if h.warmwasserAufteilung.warmwasserKwh > 0 {
                messtext += "; \(Geld.zahl(h.warmwasserAufteilung.warmwasserKwh, 0)) kWh von \(Geld.zahl(h.warmwasserAufteilung.gesamtwaermeKwh, 0)) kWh = \(Geld.prozent(h.warmwasserAufteilung.anteil))"
            }
            aufteilungszeilen = """
            <tr><td>davon Warmwasserbereitung – \(messtext)</td><td class="z">\(Geld.euro(h.kostenWarmwasser))</td></tr>
            <tr><td>davon Raumheizung</td><td class="z">\(Geld.euro(h.kostenHeizung))</td></tr>
            """
        }

        var warmwasserzeilen = ""
        if h.kostenWarmwasser > 0 {
            warmwasserzeilen = """
            <tr>
              <td>Warmwasser – Grundkosten (\(Geld.zahl((1 - h.anteilVerbrauchWarmwasser) * 100, 0)) % nach Wohnfläche, § 8 Abs. 1 HeizkostenV)</td>
              <td class="z">\(Geld.euro(h.toepfe.wwGrund))</td>
              <td class="z">\(Geld.zahl(flaecheGesamt)) m²</td>
              <td class="z">\(Geld.zahl(flaecheMieter)) m²</td>
              <td class="z">\(Geld.euro(zeilen.map(\.wwGrund).summe))</td>
            </tr>
            <tr>
              <td>Warmwasser – Verbrauchskosten (\(Geld.zahl(h.anteilVerbrauchWarmwasser * 100, 0)) % nach Verbrauch)</td>
              <td class="z">\(Geld.euro(h.toepfe.wwVerbrauch))</td>
              <td class="z">\(Geld.zahl(h.bezug.verbrauchWarmwasserGesamt, 1)) m³</td>
              <td class="z">\(Geld.zahl(zeilen.map(\.verbrauchWarmwasser).summe, 1)) m³</td>
              <td class="z">\(Geld.euro(zeilen.map(\.wwVerbrauch).summe))</td>
            </tr>
            """
        }

        let kuerzung = zeilen.map(\.kuerzung15).summe
        var kuerzungszeile = ""
        if kuerzung > 0 {
            kuerzungszeile = """
            <tr><td>./. Kürzung um 15 %, weil nicht verbrauchsabhängig abgerechnet wurde (§ 12 Abs. 1 HeizkostenV)</td>
            <td class="z"></td><td class="z"></td><td class="z"></td><td class="z">− \(Geld.euro(kuerzung))</td></tr>
            """
        }

        return """
        <h2>2. Heiz- und Warmwasserkosten nach der Heizkostenverordnung</h2>

        <table>
          <thead><tr><th>Gesamtkosten der Wärmeversorgung</th><th class="z">Betrag</th></tr></thead>
          <tbody>
            <tr><td>Brennstoffkosten (\(esc(periode.heizung.brennstoff.bezeichnung)))</td><td class="z">\(Geld.euro(h.brennstoffBrutto))</td></tr>
            \(co2Zeile)
            \(kostenzeile("Betriebsstrom", periode.heizung.kosten.betriebsstrom))
            \(kostenzeile("Wartung und Instandhaltung der Heizungsanlage", periode.heizung.kosten.wartung))
            \(kostenzeile("Messdienst, Gerätemiete und Abrechnung", periode.heizung.kosten.messdienst))
            \(kostenzeile("Schornsteinfeger und Abgasmessung", periode.heizung.kosten.schornsteinfeger))
            \(kostenzeile("Sonstige Betriebskosten der Anlage", periode.heizung.kosten.sonstiges))
            <tr class="zwischensumme"><td>Umlagefähige Gesamtkosten der Wärmeversorgung</td><td class="z">\(Geld.euro(h.gesamtUmlagefaehig))</td></tr>
            \(aufteilungszeilen)
          </tbody>
        </table>

        <h3>Ihr Anteil</h3>
        <table>
          <thead>
            <tr><th>Position</th><th class="z">Gesamtkosten</th><th class="z">Maßstab gesamt</th>
                <th class="z">Ihr Maßstab</th><th class="z">Ihr Betrag</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Heizung – Grundkosten (\(Geld.zahl((1 - h.anteilVerbrauchHeizung) * 100, 0)) % nach Wohnfläche, § 7 Abs. 1 HeizkostenV)</td>
              <td class="z">\(Geld.euro(h.toepfe.heizGrund))</td>
              <td class="z">\(Geld.zahl(flaecheGesamt)) m²</td>
              <td class="z">\(Geld.zahl(flaecheMieter)) m²</td>
              <td class="z">\(Geld.euro(zeilen.map(\.heizGrund).summe))</td>
            </tr>
            <tr>
              <td>Heizung – Verbrauchskosten (\(Geld.zahl(h.anteilVerbrauchHeizung * 100, 0)) % nach erfasstem Verbrauch)</td>
              <td class="z">\(Geld.euro(h.toepfe.heizVerbrauch))</td>
              <td class="z">\(Geld.zahl(h.bezug.verbrauchHeizungGesamt, 1)) E</td>
              <td class="z">\(Geld.zahl(zeilen.map(\.verbrauchHeizung).summe, 1)) E</td>
              <td class="z">\(Geld.euro(zeilen.map(\.heizVerbrauch).summe))</td>
            </tr>
            \(warmwasserzeilen)
            \(kuerzungszeile)
          </tbody>
          <tfoot>
            <tr class="summe"><td colspan="4">Summe Ihrer Heiz- und Warmwasserkosten</td>
                <td class="z">\(Geld.euro(mieter.heizsumme))</td></tr>
          </tfoot>
        </table>
        <p class="klein">„E" bezeichnet die Anzeigeeinheiten der Heizkostenverteiler bzw. kWh bei Wärmemengenzählern.</p>
        """
    }

    // MARK: - Ergebnis

    private static func saldokasten(_ periode: Abrechnungszeitraum, _ mieter: Abrechnung.Mieterergebnis, _ datum: String) -> String {
        let faellig = Datum.plusTage(datum, max(0, periode.zahlungsfristTage))
        let vz = mieter.vorauszahlungen
        let vzText = vz.modus == .monatlich
            ? " (\(vz.monate) Monate à \(Geld.euro(vz.monatsbetrag)))"
            : ""

        let heizzeile = mieter.heizsumme != 0
            ? "<tr><td>Heiz- und Warmwasserkosten (Ziffer 2)</td><td class=\"z\">\(Geld.euro(mieter.heizsumme))</td></tr>"
            : ""

        let bezeichnung: String
        if mieter.saldo > 0 { bezeichnung = "Nachzahlung" }
        else if mieter.saldo < 0 { bezeichnung = "Guthaben zu Ihren Gunsten" }
        else { bezeichnung = "Ausgeglichen" }

        let abschluss: String
        if mieter.saldo > 0 {
            abschluss = "<p>Wir bitten um Überweisung des Nachzahlungsbetrags von <strong>\(Geld.euro(mieter.saldo))</strong> bis zum <strong>\(Datum.deutsch(faellig))</strong>.</p>"
        } else if mieter.saldo < 0 {
            abschluss = "<p>Das Guthaben von <strong>\(Geld.euro(mieter.guthaben))</strong> erstatten wir Ihnen bis zum <strong>\(Datum.deutsch(faellig))</strong> auf das uns bekannte Konto.</p>"
        } else {
            abschluss = "<p>Die Vorauszahlungen entsprechen exakt den angefallenen Kosten. Es ergibt sich keine Nachzahlung und kein Guthaben.</p>"
        }

        return """
        <div class="saldo">
          <table>
            <tr><td>Umlagefähige Betriebskosten (Ziffer 1)</td><td class="z">\(Geld.euro(mieter.summeBetriebskosten))</td></tr>
            \(heizzeile)
            <tr><td><strong>Summe Ihrer Kosten</strong></td><td class="z"><strong>\(Geld.euro(mieter.summeGesamt))</strong></td></tr>
            <tr><td>./. geleistete Vorauszahlungen\(vzText)</td><td class="z">− \(Geld.euro(vz.gesamt))</td></tr>
            <tr class="ergebnis"><td>\(bezeichnung)</td><td class="z">\(Geld.euro(abs(mieter.saldo)))</td></tr>
          </table>
        </div>
        \(abschluss)
        """
    }

    private static func paragraph35aKasten(_ mieter: Abrechnung.Mieterergebnis) -> String {
        let lohn = mieter.paragraph35a
        guard lohn.gesamt > 0 else { return "" }

        return """
        <div class="kasten">
          <h3>Bescheinigung für Ihre Einkommensteuererklärung (§ 35a EStG)</h3>
          <p>In den oben abgerechneten Beträgen sind folgende auf Sie entfallende Lohn-, Maschinen- und
          Fahrtkostenanteile (jeweils einschließlich Umsatzsteuer, ohne Materialkosten) enthalten:</p>
          <table>
            <tr><td>Haushaltsnahe Dienstleistungen (§ 35a Abs. 2 EStG)</td><td class="z">\(Geld.euro(lohn.haushaltsnah))</td></tr>
            <tr><td>Handwerkerleistungen (§ 35a Abs. 3 EStG)</td><td class="z">\(Geld.euro(lohn.handwerker))</td></tr>
            <tr class="summenzeile"><td>Summe</td><td class="z">\(Geld.euro(lohn.gesamt))</td></tr>
          </table>
          <p style="margin-top:2mm">Die Beträge wurden nach Ihrem Anteil an den jeweiligen Gesamtkosten ermittelt.
          Eine Steuerermäßigung setzt voraus, dass die Zahlung unbar erfolgt ist.</p>
        </div>
        """
    }

    private static func schluesselerlaeuterung(_ ergebnis: Abrechnung.Ergebnis, _ mieter: Abrechnung.Mieterergebnis) -> String {
        var verwendet: [Schluessel] = []
        for p in mieter.posten where !verwendet.contains(p.schluessel) {
            verwendet.append(p.schluessel)
        }
        if ergebnis.heizung != nil, !verwendet.contains(.heizung) {
            verwendet.append(.heizung)
        }
        guard !verwendet.isEmpty else { return "" }

        let punkte = verwendet.map { schluessel -> String in
            let info = Katalog.info(schluessel)
            let quelle = info.rechtsgrundlage.isEmpty ? "" : " – <em>\(esc(info.rechtsgrundlage))</em>"
            return "<li><strong>\(esc(info.kurz)):</strong> \(esc(info.bezeichnung))\(quelle)</li>"
        }.joined()

        return """
        <div class="kasten">
          <h3>Erläuterung der verwendeten Verteilerschlüssel</h3>
          <ul>\(punkte)</ul>
          <p style="margin-top:2mm">Bei einem unterjährigen Nutzungszeitraum werden die nicht verbrauchsabhängigen
          Kosten tagegenau auf Ihren Nutzungszeitraum umgerechnet. Kosten für Zeiten des Leerstands trägt der Vermieter.</p>
        </div>
        """
    }

    private static func hinweiskasten(_ periode: Abrechnungszeitraum, _ datum: String) -> String {
        let bezug = periode.zugestelltAm.isEmpty ? datum : periode.zugestelltAm
        let einwendungsfrist = Datum.plusMonate(bezug, 12)

        return """
        <div class="kasten">
          <h3>Rechtliche Hinweise</h3>
          <ul>
            <li><strong>Belegeinsicht:</strong> Sie können nach vorheriger Terminvereinbarung Einsicht in sämtliche
            Abrechnungsunterlagen nehmen (§ 259 BGB). Auf Wunsch stellen wir gegen Kostenerstattung Kopien zur Verfügung.</li>
            <li><strong>Einwendungen:</strong> Einwendungen gegen diese Abrechnung müssen Sie uns spätestens bis zum
            <strong>\(Datum.deutsch(einwendungsfrist))</strong> mitteilen, also innerhalb von zwölf Monaten nach Zugang
            (§ 556 Abs. 3 Satz 5 und 6 BGB). Danach können Sie Einwendungen nur noch geltend machen, wenn Sie die
            verspätete Geltendmachung nicht zu vertreten haben.</li>
            <li><strong>Wirtschaftlichkeit:</strong> Bei der Bewirtschaftung des Objekts wurde der Grundsatz der
            Wirtschaftlichkeit beachtet (§ 556 Abs. 3 Satz 1 BGB).</li>
            <li><strong>Umlagefähigkeit:</strong> Umgelegt wurden ausschließlich Betriebskosten im Sinne des § 2 BetrKV,
            die nach dem Mietvertrag auf Sie umzulegen sind. Verwaltungskosten sowie Kosten der Instandhaltung und
            Instandsetzung sind nicht enthalten (§ 1 Abs. 2 BetrKV).</li>
            <li><strong>Anpassung der Vorauszahlungen:</strong> Beide Vertragsparteien können nach dieser Abrechnung eine
            Anpassung der monatlichen Vorauszahlungen auf eine angemessene Höhe verlangen (§ 560 Abs. 4 BGB).</li>
          </ul>
        </div>
        """
    }

    private static let fussnote = """
    <div class="fuss">
      Erstellt mit der Nebenkosten-App. Grundlagen: §§ 556, 556a, 560 BGB · Betriebskostenverordnung (BetrKV) ·
      Heizkostenverordnung (HeizkostenV) · Kohlendioxidkostenaufteilungsgesetz (CO2KostAufG) · § 35a EStG.
    </div>
    """

    // MARK: - Interne Vermieterübersicht

    static func vermieterinhalt(_ bestand: Objektbestand, _ periode: Abrechnungszeitraum, _ ergebnis: Abrechnung.Ergebnis) -> String {
        // Nach der Nummerierung des § 2 BetrKV sortieren.
        let umlagefaehig = ergebnis.positionenUmlagefaehig.sorted { ($0.art?.nr ?? 99) < ($1.art?.nr ?? 99) }
        let nichtUmlagefaehig = ergebnis.positionenNichtUmlagefaehig

        let zeilenA = umlagefaehig.map { p -> String in
            let nummer = p.art?.nr.map { "\($0). " } ?? ""
            return """
            <tr>
              <td>\(nummer)\(esc(p.anzeigename))<span class="klein">\(esc(p.art?.rechtsgrundlage ?? ""))</span></td>
              <td class="z">\(Geld.euro(p.betragBrutto))</td>
              <td class="z">\(p.abzugBetrag > 0 ? "− " + Geld.euro(p.abzugBetrag) : "–")</td>
              <td class="z"><strong>\(Geld.euro(p.umlagebetrag))</strong></td>
              <td>\(esc(Katalog.info(p.schluessel).kurz))</td>
            </tr>
            """
        }.joined(separator: "\n")

        let zeilenB = nichtUmlagefaehig.map { p -> String in
            """
            <tr>
              <td>\(esc(p.anzeigename))<span class="klein">\(esc(p.art?.grund ?? "Keine Betriebskosten im Sinne des § 2 BetrKV"))</span></td>
              <td class="z">\(Geld.euro(p.betragBrutto))</td>
              <td>\(esc(p.art?.rechtsgrundlage ?? ""))</td>
            </tr>
            """
        }.joined(separator: "\n")

        let abzuege = umlagefaehig.filter { $0.abzugBetrag > 0 }
        var abzugsblock = ""
        if !abzuege.isEmpty {
            let zeilen = abzuege.map {
                "<tr><td>\(esc($0.anzeigename))</td><td class=\"z\">\(Geld.euro($0.abzugBetrag))</td><td>\(esc($0.abzugGrund))</td></tr>"
            }.joined(separator: "\n")
            abzugsblock = """
            <h3>Aus umlagefähigen Positionen herausgerechnete Anteile</h3>
            <table>
              <thead><tr><th>Position</th><th class="z">Abzug</th><th>Begründung</th></tr></thead>
              <tbody>\(zeilen)</tbody>
            </table>
            """
        }

        var heizblock = ""
        if let h = ergebnis.heizung {
            var co2 = ""
            if h.co2.vermieterCent > 0, let stufe = h.co2.stufe {
                co2 = "<tr><td>./. CO₂-Kostenanteil des Vermieters (Stufe \(stufe.nummer), \(Geld.zahl(h.co2.anteilVermieter * 100, 0)) %)</td><td class=\"z\">− \(Geld.euro(h.co2.vermieterCent))</td></tr>"
            }
            heizblock = """
            <h3>Heiz- und Warmwasserkosten (HeizkostenV)</h3>
            <table>
              <tbody>
                <tr><td>Kosten der Wärmeversorgung insgesamt</td><td class="z">\(Geld.euro(h.kostenGesamtRoh))</td></tr>
                \(co2)
                <tr class="summe"><td>umlagefähig</td><td class="z">\(Geld.euro(h.gesamtUmlagefaehig))</td></tr>
              </tbody>
            </table>
            """
        }

        var differenzzeile = ""
        if ergebnis.vermieter.verbrauchsdifferenz > 0 {
            differenzzeile = "<tr><td>Nicht umgelegte Zählerdifferenz (Allgemein- und Schwundwasser)</td><td class=\"z\">\(Geld.euro(ergebnis.vermieter.verbrauchsdifferenz))</td></tr>"
        }
        var kuerzungszeile = ""
        if ergebnis.vermieter.kuerzung15 > 0 {
            kuerzungszeile = "<tr><td>Kürzung nach § 12 Abs. 1 HeizkostenV</td><td class=\"z\">\(Geld.euro(ergebnis.vermieter.kuerzung15))</td></tr>"
        }

        let zeilenD = ergebnis.ergebnisse.map { e in
            """
            <tr>
              <td>\(esc(e.einheit?.bezeichnung ?? ""))</td>
              <td>\(esc(e.mieterName))</td>
              <td>\(Datum.deutsch(e.nutzungVon)) – \(Datum.deutsch(e.nutzungBis))</td>
              <td class="z">\(Geld.euro(e.summeGesamt))</td>
              <td class="z">\(Geld.euro(e.vorauszahlungen.gesamt))</td>
              <td class="z"><strong>\(e.saldo > 0 ? "+" : "")\(Geld.euro(e.saldo))</strong></td>
            </tr>
            """
        }.joined(separator: "\n")

        let summeBrutto = umlagefaehig.map(\.betragBrutto).summe
        let summeNetto = umlagefaehig.map(\.umlagebetrag).summe

        let blockB: String
        if nichtUmlagefaehig.isEmpty {
            blockB = "<p><em>Keine gesondert erfassten nicht umlagefähigen Kosten.</em></p>"
        } else {
            blockB = """
            <table>
              <thead><tr><th>Position</th><th class="z">Betrag</th><th>Rechtsgrundlage</th></tr></thead>
              <tbody>\(zeilenB)</tbody>
              <tfoot><tr class="summe"><td>Summe</td><td class="z">\(Geld.euro(ergebnis.vermieter.nichtUmlagefaehig))</td><td></td></tr></tfoot>
            </table>
            """
        }

        return """
        <div class="blatt">
        <h1>Interne Kostenübersicht \(periode.jahr)</h1>
        <p>\(esc(bestand.objekt.bezeichnung)) · \(esc(bestand.objekt.anschrift))<br>
        Vermieter: \(esc(bestand.vermieter.anzeigename))<br>
        Abrechnungszeitraum \(Datum.deutsch(ergebnis.von)) – \(Datum.deutsch(ergebnis.bis))
        <span class="warnung"> · Nicht zur Weitergabe an Mieter bestimmt</span></p>

        <h2>A. Umlagefähige Betriebskosten (§ 2 BetrKV)</h2>
        <table>
          <thead><tr><th>Kostenart</th><th class="z">Rechnungsbetrag</th><th class="z">nicht umlagef. Abzug</th>
                     <th class="z">umlagefähig</th><th>Schlüssel</th></tr></thead>
          <tbody>\(zeilenA)</tbody>
          <tfoot>
            <tr class="summe">
              <td>Summe laufende Betriebskosten</td>
              <td class="z">\(Geld.euro(summeBrutto))</td>
              <td class="z">− \(Geld.euro(ergebnis.vermieter.abzuege))</td>
              <td class="z">\(Geld.euro(summeNetto))</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        \(heizblock)

        <h2>B. Nicht umlagefähige Kosten – vom Vermieter zu tragen</h2>
        \(blockB)

        \(abzugsblock)

        <h2>C. Belastung des Vermieters</h2>
        <table>
          <tbody>
            <tr><td>Nicht umlagefähige Kosten</td><td class="z">\(Geld.euro(ergebnis.vermieter.nichtUmlagefaehig))</td></tr>
            <tr><td>Herausgerechnete Anteile umlagefähiger Positionen</td><td class="z">\(Geld.euro(ergebnis.vermieter.abzuege))</td></tr>
            <tr><td>Auf Leerstandszeiten entfallende Betriebskosten</td><td class="z">\(Geld.euro(ergebnis.vermieter.leerstandsanteil))</td></tr>
            \(differenzzeile)
            <tr><td>CO₂-Kostenanteil nach CO2KostAufG</td><td class="z">\(Geld.euro(ergebnis.vermieter.co2Anteil))</td></tr>
            \(kuerzungszeile)
            <tr class="summe"><td>Gesamtbelastung des Vermieters</td>
                <td class="z">\(Geld.euro(ergebnis.vermieter.gesamtbelastung + ergebnis.vermieter.kuerzung15))</td></tr>
          </tbody>
        </table>

        <h2>D. Ergebnisse je Mietverhältnis</h2>
        <table>
          <thead><tr><th>Einheit</th><th>Mieter</th><th>Zeitraum</th><th class="z">Kosten</th>
                     <th class="z">Vorauszahlung</th><th class="z">Saldo</th></tr></thead>
          <tbody>\(zeilenD)</tbody>
          <tfoot>
            <tr class="summe">
              <td colspan="3">Summe</td>
              <td class="z">\(Geld.euro(ergebnis.ergebnisse.map(\.summeGesamt).summe))</td>
              <td class="z">\(Geld.euro(ergebnis.ergebnisse.map(\.vorauszahlungen.gesamt).summe))</td>
              <td class="z">\(Geld.euro(ergebnis.ergebnisse.map(\.saldo).summe))</td>
            </tr>
          </tfoot>
        </table>
        <p class="klein">Ein positiver Saldo bedeutet eine Nachforderung gegen den Mieter, ein negativer Saldo ein Guthaben des Mieters.</p>
        </div>
        """
    }

    // MARK: - Hilfsfunktionen

    /// Maskiert Text für die Einbettung in HTML.
    static func esc(_ text: String) -> String {
        var ergebnis = ""
        ergebnis.reserveCapacity(text.count)
        for zeichen in text {
            switch zeichen {
            case "&": ergebnis += "&amp;"
            case "<": ergebnis += "&lt;"
            case ">": ergebnis += "&gt;"
            case "\"": ergebnis += "&quot;"
            case "'": ergebnis += "&#39;"
            default: ergebnis.append(zeichen)
            }
        }
        return ergebnis
    }
}
