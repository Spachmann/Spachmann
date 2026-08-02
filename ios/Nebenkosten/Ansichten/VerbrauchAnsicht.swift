import SwiftUI

struct VerbrauchAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher

    /// Eine Erfassungszeile: je Einheit, bei Mieterwechsel je Nutzer.
    private struct Zeile: Identifiable {
        let id: String
        let einheit: Einheit
        let mietverhaeltnis: Mietverhaeltnis?
    }

    var body: some View {
        Group {
            if speicher.aktivesObjekt == nil {
                KeinObjekt()
            } else if let index = speicher.aktiverIndex {
                inhalt(index)
            } else {
                KeinZeitraum()
            }
        }
    }

    @ViewBuilder
    private func inhalt(_ index: Int) -> some View {
        let periode = speicher.daten.abrechnungen[index]
        let zeilen = zeilen(periode)
        let mehrfach = zeilen.contains { $0.mietverhaeltnis != nil }

        Form {
            if mehrfach {
                Section {
                    Meldung(art: .hinweis,
                            titel: "Nutzerwechsel erkannt",
                            text: "Für Einheiten mit Mieterwechsel wird je Nutzer eine eigene Zeile geführt. Trage die Werte der Zwischenablesung ein – sonst teilt die App den Jahresverbrauch nur zeitanteilig auf.",
                            quelle: "§ 9b HeizkostenV")
                }
                .listRowBackground(Color.clear)
            }

            ForEach(zeilen) { zeile in
                Section {
                    ForEach(Verbrauchsart.allCases) { art in
                        ZahlFeld(titel: art.spaltentitel,
                                 wert: verbrauchsbindung(index, zeile, art),
                                 nachkomma: 1)
                    }
                } header: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(zeile.einheit.bezeichnung)
                        if let mv = zeile.mietverhaeltnis {
                            Text("\(mv.mieterName) · \(Datum.deutsch(mv.von)) – \(Datum.deutsch(mv.ende(spaetestens: periode.bis)))")
                                .font(.caption).textCase(nil).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Section {
                ForEach(Verbrauchsart.allCases) { art in
                    Wertzeile(titel: "Summe \(art.bezeichnung)",
                              wert: "\(Geld.zahl(summe(periode, art), 1)) \(art.einheit)")
                }
            } header: {
                Text("Summe der Wohnungszähler")
            }

            Section {
                ZahlFeld(titel: "Hauptzähler Kaltwasser",
                         wert: $speicher.daten.abrechnungen[index].hauptzaehler.kaltwasser,
                         einheit: "m³", nachkomma: 1)
                ZahlFeld(titel: "Hauptzähler Warmwasser",
                         wert: $speicher.daten.abrechnungen[index].hauptzaehler.warmwasser,
                         einheit: "m³", nachkomma: 1)
            } header: {
                Text("Hauptzähler")
            } footer: {
                Text("Weicht der Hauptzähler von der Summe der Wohnungszähler ab, entsteht Allgemein- und Schwundwasser. Behandlung laut Objekteinstellung: \(speicher.aktivesObjekt?.verbrauchsdifferenz.kurz ?? "–"). Wird die Differenz nach Wohnfläche verteilt, erscheint sie in der Abrechnung als eigene Zeile.")
            }
        }
    }

    // MARK: - Zeilen und Bindungen

    private func zeilen(_ periode: Abrechnungszeitraum) -> [Zeile] {
        var ergebnis: [Zeile] = []
        for einheit in speicher.einheiten {
            let mvs = speicher.mietverhaeltnisse.filter { $0.einheitId == einheit.id }.filter {
                Datum.ueberschneidungTage($0.von, $0.ende(spaetestens: periode.bis), periode.von, periode.bis) > 0
            }
            if mvs.count > 1 {
                for mv in mvs {
                    ergebnis.append(Zeile(id: "\(einheit.id):\(mv.id)", einheit: einheit, mietverhaeltnis: mv))
                }
            } else {
                ergebnis.append(Zeile(id: einheit.id, einheit: einheit, mietverhaeltnis: nil))
            }
        }
        return ergebnis
    }

    private func verbrauchsbindung(_ index: Int, _ zeile: Zeile, _ art: Verbrauchsart) -> Binding<Double> {
        Binding(
            get: {
                speicher.daten.abrechnungen[index]
                    .verbrauch(einheitId: zeile.einheit.id,
                               mietverhaeltnisId: zeile.mietverhaeltnis?.id,
                               art: art)?.wert ?? 0
            },
            set: { neu in
                speicher.daten.abrechnungen[index]
                    .setzeVerbrauch(einheitId: zeile.einheit.id,
                                    mietverhaeltnisId: zeile.mietverhaeltnis?.id,
                                    art: art,
                                    wert: neu)
            })
    }

    private func summe(_ periode: Abrechnungszeitraum, _ art: Verbrauchsart) -> Double {
        periode.verbraeuche.filter { $0.art == art }.map(\.wert).summe
    }
}
