import SwiftUI

enum Bereich: String, CaseIterable, Identifiable {
    case uebersicht, kosten, heizung, verbrauch, pruefung, dokument
    case vermieter, objekte, einheiten, mieter, daten

    var id: String { rawValue }

    var titel: String {
        switch self {
        case .uebersicht: return "Übersicht"
        case .kosten: return "Kosten"
        case .heizung: return "Heizung & Warmwasser"
        case .verbrauch: return "Verbräuche"
        case .pruefung: return "Rechtsprüfung"
        case .dokument: return "Dokument"
        case .vermieter: return "Vermieter"
        case .objekte: return "Objekte"
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
        case .vermieter: return "person.crop.square"
        case .objekte: return "building.2"
        case .einheiten: return "door.left.hand.closed"
        case .mieter: return "person.2"
        case .daten: return "externaldrive"
        }
    }

    var gruppe: String {
        switch self {
        case .uebersicht, .kosten, .heizung, .verbrauch, .pruefung, .dokument: return "Abrechnung"
        case .vermieter, .objekte, .einheiten, .mieter, .daten: return "Stammdaten"
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
                    .navigationTitle(titel)
                    .navigationBarTitleDisplayMode(.large)
            }
        }
        .navigationSplitViewStyle(.balanced)
    }

    /// Im Abrechnungsteil steht das Objekt im Titel – bei mehreren Objekten ist
    /// sonst nicht erkennbar, worauf sich die Zahlen beziehen.
    private var titel: String {
        let bereich = auswahl ?? .uebersicht
        guard bereich.gruppe == "Abrechnung", let objekt = speicher.aktivesObjekt else { return bereich.titel }
        return "\(bereich.titel) · \(objekt.anzeigename)"
    }

    private var seitenleiste: some View {
        List(selection: $auswahl) {
            if !speicher.daten.objekte.isEmpty {
                Section("Objekt") {
                    Picker("Objekt", selection: objektAuswahl) {
                        ForEach(speicher.daten.vermieter) { vermieter in
                            let eigene = speicher.daten.objekteZu(vermieterId: vermieter.id)
                            if !eigene.isEmpty {
                                Section(vermieter.name.isEmpty ? "Ohne Namen" : vermieter.name) {
                                    ForEach(eigene) { objekt in
                                        Text(objekt.anzeigename).tag(objekt.id)
                                    }
                                }
                            }
                        }
                    }
                    .pickerStyle(.menu)
                }
            }

            if !speicher.zeitraeume.isEmpty {
                Section("Abrechnungsjahr") {
                    Picker("Jahr", selection: jahrAuswahl) {
                        ForEach(speicher.zeitraeume) { abrechnung in
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

    private var objektAuswahl: Binding<String> {
        Binding(
            get: { speicher.aktivesObjektId ?? speicher.daten.objekte.first?.id ?? "" },
            set: { speicher.aktivesObjektId = $0 })
    }

    private var jahrAuswahl: Binding<String> {
        Binding(
            get: { speicher.aktiveAbrechnungId ?? speicher.zeitraeume.first?.id ?? "" },
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
        case .vermieter:
            return speicher.daten.vermieter.isEmpty ? nil : String(speicher.daten.vermieter.count)
        case .objekte:
            return speicher.daten.objekte.isEmpty ? nil : String(speicher.daten.objekte.count)
        case .einheiten:
            return speicher.einheiten.isEmpty ? nil : String(speicher.einheiten.count)
        case .mieter:
            return speicher.mietverhaeltnisse.isEmpty ? nil : String(speicher.mietverhaeltnisse.count)
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
        case .vermieter: VermieterAnsicht()
        case .objekte: ObjekteAnsicht()
        case .einheiten: EinheitenAnsicht()
        case .mieter: MieterAnsicht()
        case .daten: DatenAnsicht()
        }
    }
}

/// Hinweis, solange kein Objekt angelegt ist.
struct KeinObjekt: View {
    @EnvironmentObject private var speicher: Datenspeicher

    var body: some View {
        Leerzustand(
            symbol: "building.2",
            titel: "Kein Objekt gewählt",
            text: "Lege zuerst einen Vermieter und ein Objekt an – jede Immobilie wird für sich abgerechnet.",
            aktionstitel: speicher.daten.vermieter.isEmpty ? "Vermieter anlegen" : "Objekt anlegen",
            aktion: {
                if speicher.daten.vermieter.isEmpty {
                    speicher.legeVermieterAn()
                } else {
                    speicher.legeObjektAn()
                }
            })
    }
}

/// Hinweis, solange kein Abrechnungszeitraum angelegt ist.
struct KeinZeitraum: View {
    @EnvironmentObject private var speicher: Datenspeicher

    var body: some View {
        Leerzustand(
            symbol: "calendar.badge.plus",
            titel: "Kein Abrechnungszeitraum",
            text: "Für dieses Objekt ist noch kein Zeitraum angelegt – üblicherweise das vergangene Kalenderjahr.",
            aktionstitel: "Zeitraum anlegen",
            aktion: {
                let jahr = Datum.jahr(von: Datum.heute()) - 1
                speicher.legeAbrechnungAn(jahr: jahr)
            })
    }
}
