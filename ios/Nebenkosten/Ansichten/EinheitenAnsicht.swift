import SwiftUI

struct EinheitenAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher
    @State private var zuLoeschen: Einheit?

    private var summeFlaeche: Double { speicher.einheiten.map(\.wohnflaeche).summe }

    private var abweichung: Bool {
        let gesamt = speicher.aktivesObjekt?.wohnflaecheGesamt ?? 0
        return gesamt > 0 && abs(gesamt - summeFlaeche) > 0.5
    }

    var body: some View {
        Group {
            if speicher.aktivesObjekt == nil {
                KeinObjekt()
            } else if speicher.einheiten.isEmpty {
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
            let anzahl = speicher.daten.mietverhaeltnisse.filter { $0.einheitId == einheit.id }.count
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
                            text: "Summe der Einheiten: \(Geld.zahl(summeFlaeche)) m², im Objekt hinterlegt: \(Geld.zahl(speicher.aktivesObjekt?.wohnflaecheGesamt ?? 0)) m².",
                            quelle: "§ 556a Abs. 1 BGB")
                    Button("Summe der Einheiten übernehmen") { speicher.uebernehmeWohnflaeche() }
                }
            }

            ForEach(speicher.einheiten) { eintrag in
                if let index = speicher.daten.einheiten.firstIndex(where: { $0.id == eintrag.id }) {
                    einheitsabschnitt($speicher.daten.einheiten[index])
                }
            }

            Section {
                Wertzeile(titel: "Einheiten insgesamt", wert: String(speicher.einheiten.count))
                Wertzeile(titel: "Wohnfläche insgesamt", wert: "\(Geld.zahl(summeFlaeche)) m²", fett: true)
            }
        }
    }

    @ViewBuilder
    private func einheitsabschnitt(_ einheit: Binding<Einheit>) -> some View {
        Group {
                Section {
                    TextField("Bezeichnung", text: $einheit.bezeichnung)
                    TextField("Lage", text: $einheit.lage)
                    ZahlFeld(titel: "Wohnfläche", wert: $einheit.wohnflaeche, einheit: "m²")
                    ZahlFeld(titel: "Miteigentumsanteile", wert: $einheit.mea,
                             hinweis: "optional, nur beim MEA-Schlüssel benötigt")
                    Button(role: .destructive) {
                        zuLoeschen = einheit.wrappedValue
                    } label: {
                        Label("Einheit löschen", systemImage: "trash")
                    }
                } header: {
                    HStack {
                        Text(einheit.wrappedValue.bezeichnung.isEmpty ? "Ohne Bezeichnung" : einheit.wrappedValue.bezeichnung)
                        Spacer()
                        Text("\(Geld.zahl(einheit.wrappedValue.wohnflaeche)) m²").monospacedDigit()
                    }
                }
        }
    }
}
