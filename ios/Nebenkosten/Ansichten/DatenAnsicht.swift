import SwiftUI
import UniformTypeIdentifiers

struct DatenAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher

    @State private var sicherungsdatei: URL?
    @State private var zeigeImport = false
    @State private var zeigeNeuesJahr = false
    @State private var neuesJahr = ""
    @State private var zeigeDemofrage = false
    @State private var zeigeLoeschfrage = false
    @State private var meldung: String?

    var body: some View {
        Form {
            Section {
                if speicher.daten.abrechnungen.isEmpty {
                    Text("Noch kein Abrechnungszeitraum angelegt.").foregroundStyle(.secondary)
                } else {
                    ForEach(speicher.daten.abrechnungen) { abrechnung in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(String(abrechnung.jahr)).font(.body.weight(.semibold))
                                Text("\(Datum.deutsch(abrechnung.von)) – \(Datum.deutsch(abrechnung.bis)) · \(abrechnung.positionen.count) Positionen")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if abrechnung.id == speicher.aktiveAbrechnungId {
                                Merkmal(text: "ausgewählt", farbe: .accentColor)
                            } else {
                                Button("Auswählen") { speicher.aktiveAbrechnungId = abrechnung.id }
                                    .buttonStyle(.borderless)
                            }
                        }
                        .swipeActions {
                            Button(role: .destructive) {
                                speicher.loescheAbrechnung(id: abrechnung.id)
                            } label: {
                                Label("Löschen", systemImage: "trash")
                            }
                        }
                    }
                }
                Button {
                    neuesJahr = String(vorschlagsjahr)
                    zeigeNeuesJahr = true
                } label: {
                    Label("Abrechnungszeitraum anlegen", systemImage: "calendar.badge.plus")
                }
            } header: {
                Text("Abrechnungszeiträume")
            } footer: {
                Text("Über Betriebskosten ist jährlich abzurechnen; der Zeitraum darf zwölf Monate nicht überschreiten (§ 556 Abs. 3 Satz 1 BGB).")
            }

            Section {
                Button {
                    erzeugeSicherung()
                } label: {
                    Label("Sicherung erstellen", systemImage: "arrow.down.doc")
                }
                if let sicherungsdatei {
                    ShareLink(item: sicherungsdatei) {
                        Label("Sicherung teilen oder speichern", systemImage: "square.and.arrow.up")
                    }
                }
                Button {
                    zeigeImport = true
                } label: {
                    Label("Sicherung laden", systemImage: "arrow.up.doc")
                }
            } header: {
                Text("Sicherung")
            } footer: {
                Text("Die Sicherung enthält alle Stammdaten, Kosten und Abrechnungen. Das Format entspricht der Web-Fassung, Sicherungen lassen sich zwischen beiden austauschen.")
            }

            Section {
                Button {
                    zeigeDemofrage = true
                } label: {
                    Label("Beispieldaten laden", systemImage: "sparkles")
                }
                Button(role: .destructive) {
                    zeigeLoeschfrage = true
                } label: {
                    Label("Alle Daten löschen", systemImage: "trash")
                }
            } header: {
                Text("Beispiel und Zurücksetzen")
            } footer: {
                Text("Beide Aktionen überschreiben die aktuell gespeicherten Daten.")
            }

            Section("Rechtlicher Hinweis") {
                Text("Diese App unterstützt bei der Erstellung einer Betriebskostenabrechnung nach §§ 556, 556a BGB, der Betriebskostenverordnung, der Heizkostenverordnung und dem Kohlendioxidkostenaufteilungsgesetz. Ob eine Kostenart im konkreten Fall umgelegt werden darf, richtet sich stets zusätzlich nach dem Mietvertrag. Die automatische Prüfung ersetzt keine rechtliche Beratung.")
                    .font(.footnote).foregroundStyle(.secondary)
            }

            Section("Datenschutz") {
                Text("Alle Daten liegen ausschließlich lokal auf diesem Gerät. Es findet keine Übertragung an Server statt.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .fileImporter(isPresented: $zeigeImport, allowedContentTypes: [.json]) { ergebnis in
            switch ergebnis {
            case .success(let url):
                do {
                    try speicher.stelleWiederHer(von: url)
                    meldung = "Sicherung geladen."
                } catch {
                    meldung = "Die Sicherung konnte nicht gelesen werden: \(error.localizedDescription)"
                }
            case .failure(let fehler):
                meldung = fehler.localizedDescription
            }
        }
        .alert("Abrechnungszeitraum anlegen", isPresented: $zeigeNeuesJahr) {
            TextField("Jahr", text: $neuesJahr).keyboardType(.numberPad)
            Button("Anlegen") {
                if let jahr = Int(neuesJahr), jahr >= 1990, jahr <= 2100 {
                    speicher.legeAbrechnungAn(jahr: jahr)
                } else {
                    meldung = "Bitte ein Jahr zwischen 1990 und 2100 angeben."
                }
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Für welches Jahr soll abgerechnet werden?")
        }
        .confirmationDialog("Beispieldaten laden?", isPresented: $zeigeDemofrage) {
            Button("Laden und überschreiben", role: .destructive) { speicher.ladeDemodaten() }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Die aktuell gespeicherten Daten werden überschrieben.")
        }
        .confirmationDialog("Wirklich alle Daten löschen?", isPresented: $zeigeLoeschfrage) {
            Button("Unwiderruflich löschen", role: .destructive) { speicher.setzeZurueck() }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Diese Aktion kann nicht rückgängig gemacht werden. Erstelle vorher eine Sicherung.")
        }
        .alert("Hinweis", isPresented: Binding(get: { meldung != nil }, set: { if !$0 { meldung = nil } })) {
            Button("OK", role: .cancel) { meldung = nil }
        } message: {
            Text(meldung ?? "")
        }
    }

    private var vorschlagsjahr: Int {
        let jahre = speicher.daten.abrechnungen.map(\.jahr)
        return (jahre.max() ?? Datum.jahr(von: Datum.heute()) - 1) + (jahre.isEmpty ? 0 : 1)
    }

    private func erzeugeSicherung() {
        do {
            sicherungsdatei = try speicher.sicherungsdatei()
            meldung = "Sicherung erstellt. Über „Teilen“ kannst du sie in Dateien oder iCloud ablegen."
        } catch {
            meldung = "Sicherung fehlgeschlagen: \(error.localizedDescription)"
        }
    }
}
