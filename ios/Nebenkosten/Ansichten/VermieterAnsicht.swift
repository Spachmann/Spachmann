import SwiftUI

/// Wer vermietet? Mehrere Einträge sind der Normalfall, wenn teils privat und
/// teils über eine Gesellschaft vermietet wird.
struct VermieterAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher
    @State private var zuLoeschen: Vermieter?

    var body: some View {
        Group {
            if speicher.daten.vermieter.isEmpty {
                Leerzustand(
                    symbol: "person.crop.square",
                    titel: "Kein Vermieter erfasst",
                    text: "Lege für jede vermietende Partei einen Eintrag an – etwa dich persönlich und daneben eine GbR. Jedem Vermieter ordnest du anschließend seine Objekte zu.",
                    aktionstitel: "Vermieter anlegen",
                    aktion: { speicher.legeVermieterAn() })
            } else {
                liste
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { speicher.legeVermieterAn() } label: {
                    Label("Vermieter", systemImage: "plus")
                }
            }
        }
        .confirmationDialog(
            "Vermieter löschen?",
            isPresented: Binding(get: { zuLoeschen != nil }, set: { if !$0 { zuLoeschen = nil } }),
            presenting: zuLoeschen
        ) { vermieter in
            Button("Löschen", role: .destructive) {
                speicher.loescheVermieter(id: vermieter.id)
                zuLoeschen = nil
            }
            Button("Abbrechen", role: .cancel) { zuLoeschen = nil }
        } message: { vermieter in
            let anzahl = speicher.daten.objekteZu(vermieterId: vermieter.id).count
            Text(anzahl > 0
                 ? "„\(vermieter.name)“ und \(anzahl) zugehörige(s) Objekt(e) mit allen Einheiten, Mietverhältnissen und Abrechnungen werden entfernt."
                 : "„\(vermieter.name)“ wird entfernt.")
        }
    }

    private var liste: some View {
        Form {
            ForEach(speicher.daten.vermieter) { vermieter in
                if let index = speicher.daten.vermieter.firstIndex(where: { $0.id == vermieter.id }) {
                    abschnitt($speicher.daten.vermieter[index])
                }
            }

            Section {
                Text("Der Mieter muss erkennen können, wer abrechnet und wo er Belegeinsicht nehmen kann (§ 259 BGB). Gesellschaften handeln nur durch ihre Vertreter – deshalb gehört bei einer GbR auch die Vertretung in die Abrechnung.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func abschnitt(_ vermieter: Binding<Vermieter>) -> some View {
        let eigene = speicher.daten.objekteZu(vermieterId: vermieter.wrappedValue.id)

        Section {
            TextField("Name oder Firma", text: vermieter.name)

            Picker("Rechtsform", selection: vermieter.rechtsform) {
                ForEach(Rechtsform.allCases) { form in
                    Text(form.bezeichnung).tag(form)
                }
            }

            if vermieter.wrappedValue.rechtsform.vertretungNoetig {
                VStack(alignment: .leading, spacing: 2) {
                    TextField("Vertreten durch", text: vermieter.vertretenDurch)
                    Text("Zum Beispiel „Kim Spachmann und Jana Spachmann“ – erscheint im Kopf und in der Unterschrift der Abrechnung.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }

            TextField("Straße und Hausnummer", text: vermieter.strasse)
            TextField("PLZ", text: vermieter.plz)
            TextField("Ort", text: vermieter.ort)
            TextField("Telefon", text: vermieter.telefon).keyboardType(.phonePad)
            TextField("E-Mail", text: vermieter.email)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
            TextField("IBAN", text: vermieter.iban)
            TextField("Bank", text: vermieter.bank)
            TextField("Steuernummer", text: vermieter.steuernummer)

            if eigene.isEmpty {
                Text("Noch kein Objekt zugeordnet.").font(.caption).foregroundStyle(.secondary)
            } else {
                Text("Objekte: \(eigene.map(\.anzeigename).joined(separator: " · "))")
                    .font(.caption).foregroundStyle(.secondary)
            }

            Button(role: .destructive) {
                zuLoeschen = vermieter.wrappedValue
            } label: {
                Label("Vermieter löschen", systemImage: "trash")
            }
        } header: {
            HStack {
                Text(vermieter.wrappedValue.name.isEmpty ? "Ohne Namen" : vermieter.wrappedValue.name)
                Spacer()
                Merkmal(text: vermieter.wrappedValue.rechtsform.bezeichnung)
                Merkmal(text: "\(eigene.count) Objekt(e)", farbe: eigene.isEmpty ? .orange : .green)
            }
        }
    }
}
