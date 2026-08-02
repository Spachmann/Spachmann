import SwiftUI

struct UebersichtAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher

    var body: some View {
        Group {
            if speicher.daten.einheiten.isEmpty {
                Leerzustand(
                    symbol: "house",
                    titel: "Noch keine Daten erfasst",
                    text: "Lege zuerst Stammdaten und Wohneinheiten an – oder lade den Beispieldatensatz, um die App auszuprobieren.",
                    aktionstitel: "Beispieldaten laden",
                    aktion: { speicher.ladeDemodaten() })
            } else if let ergebnis = speicher.ergebnis {
                inhalt(ergebnis)
            } else {
                KeinZeitraum()
            }
        }
    }

    @ViewBuilder
    private func inhalt(_ ergebnis: Abrechnung.Ergebnis) -> some View {
        List {
            Section {
                if let pruefung = speicher.pruefung {
                    if pruefung.fehler > 0 {
                        Meldung(art: .fehler,
                                titel: "\(pruefung.fehler) Punkt(e) verhindern eine wirksame Abrechnung",
                                text: "Die Abrechnung sollte so nicht versendet werden. Die Rechtsprüfung zeigt die Einzelheiten.")
                    } else if pruefung.warnungen > 0 {
                        Meldung(art: .warnung,
                                titel: "\(pruefung.warnungen) Warnung(en)",
                                text: "Die Abrechnung ist formell erstellbar, einzelne Punkte solltest du aber prüfen.")
                    } else {
                        Meldung(art: .erfolg,
                                titel: "Abrechnung ist erstellbar",
                                text: "Alle formellen Mindestanforderungen sind erfüllt.")
                    }
                }
            }
            .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
            .listRowBackground(Color.clear)

            Section {
                Kennzahlenraster {
                    Kennzahl(titel: "Gesamtkosten",
                             wert: Geld.euro(ergebnis.summen.gesamtkosten),
                             zusatz: "alle erfassten Rechnungen")
                    Kennzahl(titel: "Umlagefähig",
                             wert: Geld.euro(ergebnis.summen.umlagefaehig),
                             zusatz: anteilstext(ergebnis),
                             farbe: .green)
                    Kennzahl(titel: "Nicht umlagefähig",
                             wert: Geld.euro(ergebnis.summen.nichtUmlagefaehig),
                             zusatz: "trägt der Vermieter",
                             farbe: .red)
                    Kennzahl(titel: "Auf Mieter umgelegt",
                             wert: Geld.euro(ergebnis.summen.aufMieterUmgelegt),
                             zusatz: "\(ergebnis.ergebnisse.count) Mietverhältnis(se)")
                }
            }
            .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
            .listRowBackground(Color.clear)

            Section("Ergebnis je Mietverhältnis") {
                ForEach(ergebnis.ergebnisse) { eintrag in
                    mieterzeile(eintrag)
                }
            }

            Section("Vom Vermieter zu tragen") {
                Wertzeile(titel: "Nicht umlagefähige Kosten",
                          wert: Geld.euro(ergebnis.vermieter.nichtUmlagefaehig))
                Wertzeile(titel: "Herausgerechnete Anteile",
                          wert: Geld.euro(ergebnis.vermieter.abzuege))
                Wertzeile(titel: "Leerstandsanteil",
                          wert: Geld.euro(ergebnis.vermieter.leerstandsanteil))
                if ergebnis.vermieter.co2Anteil > 0 {
                    Wertzeile(titel: "CO₂-Anteil nach CO2KostAufG",
                              wert: Geld.euro(ergebnis.vermieter.co2Anteil))
                }
                if ergebnis.vermieter.verbrauchsdifferenz > 0 {
                    Wertzeile(titel: "Nicht umgelegte Zählerdifferenz",
                              wert: Geld.euro(ergebnis.vermieter.verbrauchsdifferenz))
                }
                Wertzeile(titel: "Gesamtbelastung",
                          wert: Geld.euro(ergebnis.vermieter.gesamtbelastung),
                          fett: true)
            }

            Section {
                Text(objektzeile)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var objektzeile: String {
        let objekt = speicher.daten.objekt
        let name = objekt.bezeichnung.isEmpty ? objekt.strasse : objekt.bezeichnung
        return "\(name) · \(speicher.daten.einheiten.count) Einheiten · \(Geld.zahl(speicher.daten.summeWohnflaechen)) m²"
    }

    private func anteilstext(_ ergebnis: Abrechnung.Ergebnis) -> String {
        guard ergebnis.summen.gesamtkosten > 0 else { return "der Gesamtkosten" }
        let quote = Double(ergebnis.summen.umlagefaehig) / Double(ergebnis.summen.gesamtkosten)
        return "\(Geld.prozent(quote, 1)) der Gesamtkosten"
    }

    private func mieterzeile(_ eintrag: Abrechnung.Mieterergebnis) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(eintrag.mieterName).font(.body.weight(.semibold))
                    Text(eintrag.einheit?.bezeichnung ?? "")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if eintrag.saldo > 0 {
                    Merkmal(text: "Nachzahlung \(Geld.euro(eintrag.saldo))", farbe: .red)
                } else if eintrag.saldo < 0 {
                    Merkmal(text: "Guthaben \(Geld.euro(eintrag.guthaben))", farbe: .green)
                } else {
                    Merkmal(text: "ausgeglichen")
                }
            }
            HStack(spacing: 14) {
                beschriftet("Zeitraum", "\(Datum.deutsch(eintrag.nutzungVon)) – \(Datum.deutsch(eintrag.nutzungBis))")
                beschriftet("Kosten", Geld.euro(eintrag.summeGesamt))
                beschriftet("Vorauszahlung", Geld.euro(eintrag.vorauszahlungen.gesamt))
            }
        }
        .padding(.vertical, 3)
    }

    private func beschriftet(_ titel: String, _ wert: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(titel).font(.caption2).foregroundStyle(.secondary)
            Text(wert).font(.caption).monospacedDigit()
        }
    }
}
