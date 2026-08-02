import SwiftUI

struct KostenAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher
    @State private var zeigeKatalog = false
    @State private var zuLoeschen: Position?

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
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { speicher.legePositionAn() } label: {
                    Label("Position", systemImage: "plus")
                }
                .disabled(speicher.aktiverIndex == nil)
            }
            ToolbarItem(placement: .secondaryAction) {
                Button { zeigeKatalog = true } label: {
                    Label("Kostenarten-Katalog", systemImage: "list.bullet.rectangle")
                }
            }
        }
        .sheet(isPresented: $zeigeKatalog) { KatalogAnsicht() }
        .confirmationDialog(
            "Position löschen?",
            isPresented: Binding(get: { zuLoeschen != nil }, set: { if !$0 { zuLoeschen = nil } }),
            presenting: zuLoeschen
        ) { position in
            Button("Löschen", role: .destructive) {
                speicher.loeschePosition(id: position.id)
                zuLoeschen = nil
            }
            Button("Abbrechen", role: .cancel) { zuLoeschen = nil }
        } message: { position in
            Text("„\(position.anzeigename)“ wird entfernt.")
        }
    }

    @ViewBuilder
    private func inhalt(_ index: Int) -> some View {
        let periode = speicher.daten.abrechnungen[index]
        let umlagefaehig = periode.positionen.filter(\.istUmlagefaehig)
        let nicht = periode.positionen.filter { !$0.istUmlagefaehig }
        let summeUmlage = umlagefaehig.map(\.umlagebetrag).summe
        let summeNicht = nicht.map(\.betragBrutto).summe + umlagefaehig.map(\.abzugBetrag).summe

        Form {
            Section {
                Kennzahlenraster {
                    Kennzahl(titel: "Umlagefähig", wert: Geld.euro(summeUmlage),
                             zusatz: "\(umlagefaehig.count) Positionen nach § 2 BetrKV", farbe: .green)
                    Kennzahl(titel: "Nicht umlagefähig", wert: Geld.euro(summeNicht),
                             zusatz: "\(nicht.count) Positionen und Abzüge", farbe: .red)
                    Kennzahl(titel: "Erfasste Rechnungen", wert: String(periode.positionen.count),
                             zusatz: "ohne Heizkosten")
                }
            }
            .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
            .listRowBackground(Color.clear)

            if periode.positionen.isEmpty {
                Section {
                    Leerzustand(
                        symbol: "doc.text",
                        titel: "Noch keine Kosten erfasst",
                        text: "Lege für jede Rechnung eine Position an. Die Kostenart bestimmt, ob umgelegt werden darf – Verwaltung und Instandhaltung landen automatisch beim Vermieter.",
                        aktionstitel: "Erste Position anlegen",
                        aktion: { speicher.legePositionAn() })
                }
                .listRowBackground(Color.clear)
            }

            ForEach($speicher.daten.abrechnungen[index].positionen) { $position in
                PositionsAbschnitt(position: $position, loeschen: { zuLoeschen = position })
            }
        }
    }
}

// MARK: - Einzelne Position

private struct PositionsAbschnitt: View {
    @EnvironmentObject private var speicher: Datenspeicher
    @Binding var position: Position
    let loeschen: () -> Void

    @State private var zeigeDetails = false

    var body: some View {
        Section {
            Picker("Kostenart", selection: kostenart) {
                Section("Umlagefähig – § 2 BetrKV") {
                    ForEach(Katalog.betriebskosten) { art in
                        Text(art.nummerierteBezeichnung).tag(art.id)
                    }
                }
                Section("Nicht umlagefähig") {
                    ForEach(Katalog.nichtUmlagefaehig) { art in
                        Text(art.bezeichnung).tag(art.id)
                    }
                }
            }

            TextField("Eigene Bezeichnung", text: $position.bezeichnung)
            GeldFeld(titel: "Rechnungsbetrag brutto", wert: $position.betragBrutto)

            if Katalog.istUmlagefaehigeArt(position.kostenartId), !Katalog.heizarten.contains(position.kostenartId) {
                Picker("Verteilerschlüssel", selection: $position.schluessel) {
                    ForEach(Schluessel.waehlbare) { schluessel in
                        Text(Katalog.info(schluessel).kurz).tag(schluessel)
                    }
                }
                Text(Katalog.info(position.schluessel).rechtsgrundlage)
                    .font(.caption).foregroundStyle(.secondary)
            }

            if position.schluessel == .direkt {
                Picker("Einheit", selection: $position.direktEinheitId) {
                    Text("– bitte wählen –").tag("")
                    ForEach(speicher.einheiten) { einheit in
                        Text(einheit.bezeichnung).tag(einheit.id)
                    }
                }
            }

            if position.schluessel == .verbrauchWasser {
                Picker("Verbrauchsart", selection: $position.verbrauchsart) {
                    Text("Kaltwasser").tag(Verbrauchsart.kaltwasser)
                    Text("Warmwasser").tag(Verbrauchsart.warmwasser)
                }
            }

            if let warnung = position.art?.warnung {
                Meldung(art: .warnung, titel: "Zu dieser Kostenart", text: warnung,
                        quelle: position.art?.rechtsgrundlage ?? "")
            }
            if Katalog.heizarten.contains(position.kostenartId) {
                Meldung(art: .hinweis,
                        titel: "Wird über die Heizkostenabrechnung erfasst",
                        text: "Trage Heiz- und Warmwasserkosten im Bereich „Heizung & Warmwasser“ ein, damit die HeizkostenV korrekt angewendet wird. Diese Position wird nicht umgelegt.",
                        quelle: "§§ 6–9 HeizkostenV")
            }

            DisclosureGroup("Abzüge, § 35a EStG, Zeitraum und Beleg", isExpanded: $zeigeDetails) {
                GeldFeld(titel: "Nicht umlagefähiger Abzug", wert: $position.abzugBetrag,
                         hinweis: "zum Beispiel der Reparaturanteil des Hausmeisters")
                TextField("Begründung des Abzugs", text: $position.abzugGrund)

                GeldFeld(titel: "Lohnanteil haushaltsnah", wert: $position.lohnanteilHaushaltsnah,
                         hinweis: "§ 35a Abs. 2 EStG – wird dem Mieter bescheinigt")
                GeldFeld(titel: "Lohnanteil Handwerker", wert: $position.lohnanteilHandwerker,
                         hinweis: "§ 35a Abs. 3 EStG")

                DatumFeld(titel: "Kosten gelten ab", wert: $position.zeitraumVon, optional: true,
                          hinweis: "nur ausfüllen, wenn die Kosten nur einen Teil des Zeitraums betreffen")
                DatumFeld(titel: "Kosten gelten bis", wert: $position.zeitraumBis, optional: true)

                TextField("Lieferant", text: $position.lieferant)
                TextField("Belegnummer", text: $position.beleg)
                TextField("Notiz", text: $position.notiz, axis: .vertical).lineLimit(1...4)

                Toggle("Umlage auf Mieter zulassen", isOn: $position.umlagefaehig)

                if position.kostenartId == "sonstige" {
                    Toggle("Im Mietvertrag ausdrücklich benannt", isOn: $position.imMietvertragVereinbart)
                    Text("Pflicht für § 2 Nr. 17 BetrKV – eine Sammelklausel genügt nicht (BGH VIII ZR 137/09).")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }

            Button(role: .destructive, action: loeschen) {
                Label("Position löschen", systemImage: "trash")
            }
        } header: {
            HStack {
                Text(position.anzeigename).lineLimit(1)
                Spacer()
                Merkmal(text: position.istUmlagefaehig ? "umlagefähig" : "nicht umlagefähig",
                        farbe: position.istUmlagefaehig ? .green : .red)
                Text(Geld.euro(position.umlagebetrag)).monospacedDigit()
            }
        }
    }

    /// Beim Wechsel der Kostenart Schlüssel und Umlagefähigkeit nachziehen.
    private var kostenart: Binding<String> {
        Binding(
            get: { position.kostenartId },
            set: { neu in
                position.kostenartId = neu
                if let art = Katalog.art(neu) {
                    position.umlagefaehig = art.istUmlagefaehigeArt
                    if art.istUmlagefaehigeArt { position.schluessel = art.schluessel }
                }
            })
    }
}

// MARK: - Katalog zum Nachschlagen

struct KatalogAnsicht: View {
    @Environment(\.dismiss) private var schliessen

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Umlagefähig ist ausschließlich, was im abschließenden Katalog des § 2 BetrKV steht. Alles andere trägt der Vermieter.")
                        .font(.footnote).foregroundStyle(.secondary)
                }

                Section("Umlagefähig – § 2 BetrKV") {
                    ForEach(Katalog.betriebskosten) { art in
                        eintrag(art)
                    }
                }

                Section("Nicht umlagefähig – § 1 Abs. 2 BetrKV") {
                    ForEach(Katalog.nichtUmlagefaehig) { art in
                        eintrag(art)
                    }
                }
            }
            .navigationTitle("Kostenarten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { schliessen() }
                }
            }
        }
    }

    private func eintrag(_ art: Kostenartinfo) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(art.nummerierteBezeichnung).font(.body.weight(.medium))
            Text(art.rechtsgrundlage).font(.caption).foregroundStyle(.secondary)
            if !art.beispiele.isEmpty {
                Text(art.beispiele.joined(separator: " · ")).font(.caption)
            }
            if let grund = art.grund {
                Text(grund).font(.caption).foregroundStyle(.red)
            }
            if let warnung = art.warnung {
                Text(warnung).font(.caption).foregroundStyle(.orange)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 2)
    }
}
