import SwiftUI

struct MieterAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher
    @State private var zuLoeschen: Mietverhaeltnis?

    var body: some View {
        Group {
            if speicher.aktivesObjekt == nil {
                KeinObjekt()
            } else if speicher.einheiten.isEmpty {
                Leerzustand(
                    symbol: "door.left.hand.closed",
                    titel: "Erst Einheiten anlegen",
                    text: "Ein Mietverhältnis gehört immer zu einer Wohneinheit.")
            } else if speicher.mietverhaeltnisse.isEmpty {
                Leerzustand(
                    symbol: "person.2",
                    titel: "Keine Mietverhältnisse",
                    text: "Erfasse für jede Einheit die Mietverhältnisse mit Beginn und Ende. Bei einem Mieterwechsel legst du zwei Einträge an – die App rechnet tagegenau ab und behandelt die Lücke als Leerstand.",
                    aktionstitel: "Mietverhältnis anlegen",
                    aktion: { speicher.legeMietverhaeltnisAn() })
            } else {
                liste
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    speicher.legeMietverhaeltnisAn()
                } label: {
                    Label("Mietverhältnis", systemImage: "plus")
                }
                .disabled(speicher.einheiten.isEmpty)
            }
        }
        .confirmationDialog(
            "Mietverhältnis löschen?",
            isPresented: Binding(get: { zuLoeschen != nil }, set: { if !$0 { zuLoeschen = nil } }),
            presenting: zuLoeschen
        ) { mv in
            Button("Löschen", role: .destructive) {
                speicher.loescheMietverhaeltnis(id: mv.id)
                zuLoeschen = nil
            }
            Button("Abbrechen", role: .cancel) { zuLoeschen = nil }
        } message: { mv in
            Text("„\(mv.mieterName)“ und die zugehörigen Verbrauchswerte werden entfernt.")
        }
    }

    private var liste: some View {
        Form {
            ForEach(speicher.mietverhaeltnisse) { eintrag in
                if let index = speicher.daten.mietverhaeltnisse.firstIndex(where: { $0.id == eintrag.id }) {
                    mietabschnitt($speicher.daten.mietverhaeltnisse[index])
                }
            }
        }
    }

    @ViewBuilder
    private func mietabschnitt(_ mv: Binding<Mietverhaeltnis>) -> some View {
        Group {
                Section {
                    TextField("Name des Mieters", text: mv.mieterName)

                    Picker("Wohneinheit", selection: mv.einheitId) {
                        ForEach(speicher.einheiten) { einheit in
                            Text(einheit.bezeichnung).tag(einheit.id)
                        }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        TextField("Anschrift für die Abrechnung", text: mv.mieterAnschrift, axis: .vertical)
                            .lineLimit(1...3)
                        Text("Kommas oder Zeilenumbrüche trennen die Zeilen im Anschriftenfeld.")
                            .font(.caption).foregroundStyle(.secondary)
                    }

                    DatumFeld(titel: "Mietbeginn", wert: mv.von)
                    DatumFeld(titel: "Mietende", wert: mv.bis, optional: true,
                              hinweis: "leer lassen, solange das Mietverhältnis läuft")
                    ZahlFeld(titel: "Personen im Haushalt", wert: mv.personen,
                             einheit: "Pers.", nachkomma: 0,
                             hinweis: "Maßstab für den Personenschlüssel")

                    Picker("Vorauszahlungen", selection: mv.vzModus) {
                        ForEach(Vorauszahlungsmodus.allCases) { modus in
                            Text(modus.bezeichnung).tag(modus)
                        }
                    }

                    if mv.wrappedValue.vzModus == .gesamt {
                        GeldFeld(titel: "Betriebskosten gesamt", wert: mv.vzGesamtBetriebskosten)
                        GeldFeld(titel: "Heizkosten gesamt", wert: mv.vzGesamtHeizkosten)
                    } else {
                        GeldFeld(titel: "Betriebskosten je Monat", wert: mv.vzBetriebskostenMonat)
                        GeldFeld(titel: "Heizkosten je Monat", wert: mv.vzHeizkostenMonat)
                    }

                    if let periode = speicher.aktiveAbrechnung {
                        let eintrag = mv.wrappedValue
                        let vz = Abrechnung.berechneVorauszahlungen(eintrag, von: max(eintrag.von, periode.von),
                                                                    bis: min(eintrag.ende(spaetestens: periode.bis), periode.bis))
                        Wertzeile(titel: "Im Zeitraum berücksichtigt",
                                  wert: Geld.euro(vz.gesamt),
                                  fett: true)
                    }

                    Button(role: .destructive) {
                        zuLoeschen = mv.wrappedValue
                    } label: {
                        Label("Mietverhältnis löschen", systemImage: "trash")
                    }
                } header: {
                    HStack {
                        Text(mv.wrappedValue.mieterName.isEmpty ? "Neuer Mieter" : mv.wrappedValue.mieterName)
                        Spacer()
                        if mv.wrappedValue.bis.isEmpty {
                            Merkmal(text: "laufend", farbe: .green)
                        } else {
                            Merkmal(text: "bis \(Datum.deutsch(mv.wrappedValue.bis))", farbe: .orange)
                        }
                    }
                }
        }
    }
}
