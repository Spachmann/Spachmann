import SwiftUI

enum Bereich: String, CaseIterable, Identifiable {
    case uebersicht, kosten, heizung, verbrauch, pruefung, dokument
    case stammdaten, einheiten, mieter, daten

    var id: String { rawValue }

    var titel: String {
        switch self {
        case .uebersicht: return "Übersicht"
        case .kosten: return "Kosten"
        case .heizung: return "Heizung & Warmwasser"
        case .verbrauch: return "Verbräuche"
        case .pruefung: return "Rechtsprüfung"
        case .dokument: return "Dokument"
        case .stammdaten: return "Stammdaten"
        case .einheiten: return "Wohneinheiten"
        case .mieter: return "Mietverhältnisse"
        case .daten: return "Daten & Sicherung"
        }
    }

    var symbol: String {
        switch self {
        case .uebersicht: return "house"
        case .kosten: return "doc.text"
        case .heizung: return "flame"
        case .verbrauch: return "drop"
        case .pruefung: return "checkmark.seal"
        case .dokument: return "doc.richtext"
        case .stammdaten: return "building.2"
        case .einheiten: return "door.left.hand.closed"
        case .mieter: return "person.2"
        case .daten: return "externaldrive"
        }
    }

    var gruppe: String {
        switch self {
        case .uebersicht, .kosten, .heizung, .verbrauch, .pruefung, .dokument: return "Abrechnung"
        case .stammdaten, .einheiten, .mieter, .daten: return "Stammdaten"
        }
    }

    static var abrechnungsbereiche: [Bereich] { allCases.filter { $0.gruppe == "Abrechnung" } }
    static var stammdatenbereiche: [Bereich] { allCases.filter { $0.gruppe == "Stammdaten" } }
}

struct RootAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher
    @State private var auswahl: Bereich? = .uebersicht
    @State private var spalten: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $spalten) {
            seitenleiste
        } detail: {
            NavigationStack {
                inhalt
                    .navigationTitle((auswahl ?? .uebersicht).titel)
                    .navigationBarTitleDisplayMode(.large)
            }
        }
        .navigationSplitViewStyle(.balanced)
    }

    private var seitenleiste: some View {
        List(selection: $auswahl) {
            if !speicher.daten.abrechnungen.isEmpty {
                Section("Abrechnungsjahr") {
                    Picker("Jahr", selection: jahrAuswahl) {
                        ForEach(speicher.daten.abrechnungen) { abrechnung in
                            Text(String(abrechnung.jahr)).tag(abrechnung.id)
                        }
                    }
                    .pickerStyle(.menu)
                }
            }

            Section("Abrechnung") {
                ForEach(Bereich.abrechnungsbereiche) { bereich in
                    zeile(bereich)
                }
            }

            Section("Stammdaten") {
                ForEach(Bereich.stammdatenbereiche) { bereich in
                    zeile(bereich)
                }
            }
        }
        .navigationTitle("Nebenkosten")
        .listStyle(.sidebar)
    }

    private var jahrAuswahl: Binding<String> {
        Binding(
            get: { speicher.aktiveAbrechnungId ?? speicher.daten.abrechnungen.first?.id ?? "" },
            set: { speicher.aktiveAbrechnungId = $0 })
    }

    @ViewBuilder
    private func zeile(_ bereich: Bereich) -> some View {
        Label {
            HStack {
                Text(bereich.titel)
                Spacer()
                if let text = abzeichen(bereich) {
                    Text(text)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(abzeichenfarbe(bereich).opacity(0.18), in: Capsule())
                        .foregroundStyle(abzeichenfarbe(bereich))
                }
            }
        } icon: {
            Image(systemName: bereich.symbol)
        }
        .tag(bereich)
    }

    private func abzeichen(_ bereich: Bereich) -> String? {
        switch bereich {
        case .pruefung:
            guard let pruefung = speicher.pruefung else { return nil }
            return pruefung.fehler > 0 ? String(pruefung.fehler) : "✓"
        case .kosten:
            let anzahl = speicher.aktiveAbrechnung?.positionen.count ?? 0
            return anzahl > 0 ? String(anzahl) : nil
        case .einheiten:
            return speicher.daten.einheiten.isEmpty ? nil : String(speicher.daten.einheiten.count)
        case .mieter:
            return speicher.daten.mietverhaeltnisse.isEmpty ? nil : String(speicher.daten.mietverhaeltnisse.count)
        default:
            return nil
        }
    }

    private func abzeichenfarbe(_ bereich: Bereich) -> Color {
        if bereich == .pruefung, let pruefung = speicher.pruefung, pruefung.fehler > 0 { return .red }
        return .secondary
    }

    @ViewBuilder
    private var inhalt: some View {
        switch auswahl ?? .uebersicht {
        case .uebersicht: UebersichtAnsicht()
        case .kosten: KostenAnsicht()
        case .heizung: HeizungAnsicht()
        case .verbrauch: VerbrauchAnsicht()
        case .pruefung: PruefungAnsicht()
        case .dokument: DokumentAnsicht()
        case .stammdaten: StammdatenAnsicht()
        case .einheiten: EinheitenAnsicht()
        case .mieter: MieterAnsicht()
        case .daten: DatenAnsicht()
        }
    }
}

/// Hinweis, solange kein Abrechnungszeitraum angelegt ist.
struct KeinZeitraum: View {
    @EnvironmentObject private var speicher: Datenspeicher

    var body: some View {
        Leerzustand(
            symbol: "calendar.badge.plus",
            titel: "Kein Abrechnungszeitraum",
            text: "Lege zuerst einen Abrechnungszeitraum an, zum Beispiel das vergangene Kalenderjahr.",
            aktionstitel: "Zeitraum anlegen",
            aktion: {
                let jahr = Datum.jahr(von: Datum.heute()) - 1
                speicher.legeAbrechnungAn(jahr: jahr)
            })
    }
}
