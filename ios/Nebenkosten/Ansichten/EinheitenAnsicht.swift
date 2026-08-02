import SwiftUI

struct EinheitenAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher
    @State private var zuLoeschen: Einheit?

    private var abweichung: Bool {
        let gesamt = speicher.daten.objekt.wohnflaecheGesamt
        return gesamt > 0 && abs(gesamt - speicher.daten.summeWohnflaechen) > 0.5
    }

    var body: some View {
        Group {
            if speicher.daten.einheiten.isEmpty {
                Leerzustand(
                    symbol: "door.left.hand.closed",
                    titel: "Keine Einheiten",
                    text: "Lege für jede vermietbare Wohneinheit einen Eintrag an – auch für leerstehende. Nur so bleiben Leerstandskosten beim Vermieter.",
                    aktionstitel: "Einheit anlegen",
                    aktion: { speicher.legeEinheitAn() })
            } else {
                liste
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    speicher.legeEinheitAn()
                } label: {
                    Label("Einheit", systemImage: "plus")
                }
            }
        }
        .confirmationDialog(
            "Einheit löschen?",
            isPresented: Binding(get: { zuLoeschen != nil }, set: { if !$0 { zuLoeschen = nil } }),
            presenting: zuLoeschen
        ) { einheit in
            Button("Löschen", role: .destructive) {
                speicher.loescheEinheit(id: einheit.id)
                zuLoeschen = nil
            }
            Button("Abbrechen", role: .cancel) { zuLoeschen = nil }
        } message: { einheit in
            let anzahl = speicher.daten.mietverhaeltnisseZu(einheitId: einheit.id).count
            Text(anzahl > 0
                 ? "„\(einheit.bezeichnung)“ und \(anzahl) zugehörige(s) Mietverhältnis(se) werden entfernt."
                 : "„\(einheit.bezeichnung)“ wird entfernt.")
        }
    }

    private var liste: some View {
        Form {
            if abweichung {
                Section {
                    Meldung(art: .warnung,
                            titel: "Wohnflächen weichen ab",
                            text: "Summe der Einheiten: \(Geld.zahl(speicher.daten.summeWohnflaechen)) m², im Objekt hinterlegt: \(Geld.zahl(speicher.daten.objekt.wohnflaecheGesamt)) m².",
                            quelle: "§ 556a Abs. 1 BGB")
                    Button("Summe der Einheiten übernehmen") { speicher.uebernehmeWohnflaeche() }
                }
            }

            ForEach($speicher.daten.einheiten) { $einheit in
                Section {
                    TextField("Bezeichnung", text: $einheit.bezeichnung)
                    TextField("Lage", text: $einheit.lage)
                    ZahlFeld(titel: "Wohnfläche", wert: $einheit.wohnflaeche, einheit: "m²")
                    ZahlFeld(titel: "Miteigentumsanteile", wert: $einheit.mea,
                             hinweis: "optional, nur beim MEA-Schlüssel benötigt")
                    Button(role: .destructive) {
                        zuLoeschen = einheit
                    } label: {
                        Label("Einheit löschen", systemImage: "trash")
                    }
                } header: {
                    HStack {
                        Text(einheit.bezeichnung.isEmpty ? "Ohne Bezeichnung" : einheit.bezeichnung)
                        Spacer()
                        Text("\(Geld.zahl(einheit.wohnflaeche)) m²").monospacedDigit()
                    }
                }
            }

            Section {
                Wertzeile(titel: "Einheiten insgesamt",
                          wert: String(speicher.daten.einheiten.count))
                Wertzeile(titel: "Wohnfläche insgesamt",
                          wert: "\(Geld.zahl(speicher.daten.summeWohnflaechen)) m²", fett: true)
            }
        }
    }
}
