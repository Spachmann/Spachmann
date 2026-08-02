import SwiftUI

/// Jede Immobilie ist ein eigenes Objekt mit eigenen Einheiten, Kosten und
/// Abrechnungszeiträumen. Abgerechnet wird immer je Objekt.
struct ObjekteAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher
    @State private var zuLoeschen: Objekt?

    var body: some View {
        Group {
            if speicher.daten.vermieter.isEmpty {
                Leerzustand(
                    symbol: "person.crop.square",
                    titel: "Erst einen Vermieter anlegen",
                    text: "Jedes Objekt gehört zu einem Vermieter.",
                    aktionstitel: "Vermieter anlegen",
                    aktion: { speicher.legeVermieterAn() })
            } else if speicher.daten.objekte.isEmpty {
                Leerzustand(
                    symbol: "building.2",
                    titel: "Kein Objekt erfasst",
                    text: "Lege für jede Immobilie ein Objekt an. Jedes Objekt hat eigene Einheiten, Kosten und Abrechnungszeiträume.",
                    aktionstitel: "Objekt anlegen",
                    aktion: { speicher.legeObjektAn() })
            } else {
                liste
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { speicher.legeObjektAn() } label: {
                    Label("Objekt", systemImage: "plus")
                }
                .disabled(speicher.daten.vermieter.isEmpty)
            }
        }
        .confirmationDialog(
            "Objekt löschen?",
            isPresented: Binding(get: { zuLoeschen != nil }, set: { if !$0 { zuLoeschen = nil } }),
            presenting: zuLoeschen
        ) { objekt in
            Button("Löschen", role: .destructive) {
                speicher.loescheObjekt(id: objekt.id)
                zuLoeschen = nil
            }
            Button("Abbrechen", role: .cancel) { zuLoeschen = nil }
        } message: { objekt in
            let anzahl = speicher.daten.einheitenZu(objektId: objekt.id).count
            Text(anzahl > 0
                 ? "„\(objekt.anzeigename)“ und \(anzahl) Einheit(en) samt Mietverhältnissen und Abrechnungen werden entfernt."
                 : "„\(objekt.anzeigename)“ wird entfernt.")
        }
    }

    private var liste: some View {
        Form {
            ForEach(speicher.daten.objekte) { objekt in
                if let index = speicher.daten.objekte.firstIndex(where: { $0.id == objekt.id }) {
                    abschnitt($speicher.daten.objekte[index])
                }
            }
        }
    }

    @ViewBuilder
    private func abschnitt(_ objekt: Binding<Objekt>) -> some View {
        let id = objekt.wrappedValue.id
        let eigene = speicher.daten.einheitenZu(objektId: id)
        let summeFlaeche = eigene.map(\.wohnflaeche).summe
        let aktiv = speicher.aktivesObjektId == id
        let abweichung = objekt.wrappedValue.wohnflaecheGesamt > 0
            && abs(objekt.wrappedValue.wohnflaecheGesamt - summeFlaeche) > 0.5

        Section {
            TextField("Bezeichnung", text: objekt.bezeichnung)

            Picker("Vermieter", selection: objekt.vermieterId) {
                ForEach(speicher.daten.vermieter) { vermieter in
                    Text(vermieter.name.isEmpty ? "Ohne Namen" : vermieter.name).tag(vermieter.id)
                }
            }

            TextField("Straße und Hausnummer", text: objekt.strasse)
            TextField("PLZ", text: objekt.plz)
            TextField("Ort", text: objekt.ort)

            ZahlFeld(titel: "Gesamtwohnfläche", wert: objekt.wohnflaecheGesamt, einheit: "m²")
            LabeledContent("Summe der Einheiten") {
                HStack(spacing: 10) {
                    Text("\(Geld.zahl(summeFlaeche)) m²")
                        .monospacedDigit().foregroundStyle(.secondary)
                    Button("Übernehmen") { speicher.uebernehmeWohnflaeche(objektId: id) }
                        .buttonStyle(.borderless)
                }
            }
            if abweichung {
                Meldung(art: .warnung,
                        titel: "Wohnflächen weichen ab",
                        text: "Summe der Einheiten: \(Geld.zahl(summeFlaeche)) m², hinterlegt: \(Geld.zahl(objekt.wrappedValue.wohnflaecheGesamt)) m².",
                        quelle: "§ 556a Abs. 1 BGB")
            }

            Picker("Gebäudetyp", selection: objekt.gebaeudetyp) {
                ForEach(Gebaeudetyp.allCases) { typ in
                    Text(typ.bezeichnung).tag(typ)
                }
            }
            ZahlFeld(titel: "Personen bei Leerstand", wert: objekt.leerstandPersonen,
                     einheit: "Pers.", nachkomma: 0,
                     hinweis: "Ansatz für den Personenschlüssel in Leerstandszeiten")
            Picker("Zählerdifferenz", selection: objekt.verbrauchsdifferenz) {
                ForEach(Verbrauchsdifferenz.allCases) { modus in
                    Text(modus.bezeichnung).tag(modus)
                }
            }

            TextField("Notiz", text: objekt.notiz, axis: .vertical).lineLimit(1...4)

            if !aktiv {
                Button {
                    speicher.aktivesObjektId = id
                } label: {
                    Label("Dieses Objekt bearbeiten", systemImage: "checkmark.circle")
                }
            }

            Button(role: .destructive) {
                zuLoeschen = objekt.wrappedValue
            } label: {
                Label("Objekt löschen", systemImage: "trash")
            }
        } header: {
            HStack {
                Text(objekt.wrappedValue.anzeigename)
                if aktiv { Merkmal(text: "aktiv", farbe: .green) }
                Spacer()
                Text("\(eigene.count) Einh. · \(Geld.zahl(summeFlaeche)) m²")
                    .monospacedDigit()
            }
        }
    }
}
