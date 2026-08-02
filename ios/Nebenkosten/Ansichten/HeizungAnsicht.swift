import SwiftUI

struct HeizungAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher

    private let anteile: [Double] = [0.5, 0.6, 0.7]

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
        let heizung = $speicher.daten.abrechnungen[index].heizung

        Form {
            Section {
                Toggle("Heiz- und Warmwasserkosten abrechnen", isOn: heizung.aktiv)
            } footer: {
                Text("Bei zentraler Wärmeversorgung ist die Heizkostenverordnung zwingend anzuwenden (§ 1 HeizkostenV). Hat jede Wohnung eine eigene Etagenheizung mit eigenem Liefervertrag, rechnet der Mieter direkt mit dem Versorger ab.")
            }

            if heizung.wrappedValue.aktiv {
                anlage(heizung)
                kosten(heizung)
                verteilung(heizung)
                co2Abschnitt(heizung)
                if let ergebnis = speicher.ergebnis?.heizung {
                    ergebnisAbschnitt(ergebnis)
                }
            }
        }
    }

    // MARK: - Abschnitte

    private func anlage(_ heizung: Binding<Heizungseinstellungen>) -> some View {
        Section {
            Toggle("Verbundene Anlage", isOn: heizung.verbunden)
            Toggle("Verbrauch wird erfasst", isOn: heizung.verbrauchserfassung)

            Picker("Energieträger", selection: heizung.brennstoff) {
                ForEach(Brennstoff.allCases) { brennstoff in
                    Text(brennstoff.beschriftung).tag(brennstoff)
                }
            }
            ZahlFeld(titel: "Brennstoffmenge", wert: heizung.brennstoffmenge,
                     einheit: heizung.wrappedValue.brennstoff.mengeneinheit, nachkomma: 1,
                     hinweis: "aus der Jahresrechnung des Versorgers")
            ZahlFeld(titel: "Gemessene Gesamtwärmemenge", wert: heizung.gesamtwaermeKwh,
                     einheit: "kWh", nachkomma: 0,
                     hinweis: "falls ein Wärmemengenzähler vorhanden ist – hat Vorrang vor der Berechnung aus dem Heizwert")
        } header: {
            Text("Anlage")
        } footer: {
            Text(heizung.wrappedValue.verbrauchserfassung
                 ? "Bei verbundenen Anlagen wird der Warmwasseranteil nach § 9 HeizkostenV herausgerechnet."
                 : "Ohne Verbrauchserfassung wird rein nach Fläche abgerechnet; der Mieteranteil wird automatisch um 15 % gekürzt (§ 12 Abs. 1 HeizkostenV).")
        }
    }

    private func kosten(_ heizung: Binding<Heizungseinstellungen>) -> some View {
        Section {
            GeldFeld(titel: "Brennstoff / Fernwärme", wert: heizung.kosten.brennstoff)
            GeldFeld(titel: "Betriebsstrom", wert: heizung.kosten.betriebsstrom)
            GeldFeld(titel: "Wartung der Anlage", wert: heizung.kosten.wartung,
                     hinweis: "nur Wartung – Reparaturen sind Instandsetzung und nicht umlagefähig")
            GeldFeld(titel: "Messdienst und Gerätemiete", wert: heizung.kosten.messdienst)
            GeldFeld(titel: "Schornsteinfeger", wert: heizung.kosten.schornsteinfeger)
            GeldFeld(titel: "Sonstiges", wert: heizung.kosten.sonstiges)
            Wertzeile(titel: "Summe", wert: Geld.euro(heizung.wrappedValue.kosten.gesamt), fett: true)
        } header: {
            Text("Kosten der Wärmeversorgung")
        } footer: {
            Text("Nur Betriebskosten der Anlage nach § 2 Nr. 4 bis 6 BetrKV.")
        }
    }

    private func verteilung(_ heizung: Binding<Heizungseinstellungen>) -> some View {
        Section {
            Picker("Verbrauchsanteil Heizung", selection: heizung.anteilVerbrauchHeizung) {
                ForEach(anteile, id: \.self) { anteil in
                    Text(anteilstext(anteil)).tag(anteil)
                }
            }
            Picker("Verbrauchsanteil Warmwasser", selection: heizung.anteilVerbrauchWarmwasser) {
                ForEach(anteile, id: \.self) { anteil in
                    Text(anteilstext(anteil)).tag(anteil)
                }
            }

            if heizung.wrappedValue.verbunden {
                Picker("Warmwasser ermitteln", selection: heizung.warmwasser.modus) {
                    ForEach(Warmwassermethode.allCases) { methode in
                        Text(methode.bezeichnung).tag(methode)
                    }
                }

                switch heizung.wrappedValue.warmwasser.modus {
                case .wmz:
                    ZahlFeld(titel: "Wärmemenge Warmwasser", wert: heizung.warmwasser.warmwasserKwh,
                             einheit: "kWh", nachkomma: 0)
                case .formel:
                    ZahlFeld(titel: "Warmwasserverbrauch gesamt", wert: heizung.warmwasser.volumen,
                             einheit: "m³", nachkomma: 1)
                    ZahlFeld(titel: "Mittlere Temperatur", wert: heizung.warmwasser.temperatur,
                             einheit: "°C", nachkomma: 0, hinweis: "Standardannahme 60 °C")
                case .prozent:
                    ZahlFeld(titel: "Warmwasseranteil", wert: prozentBindung(heizung),
                             einheit: "%", nachkomma: 1,
                             hinweis: "nur zulässig, wenn eine Messung technisch nicht möglich ist")
                }
            } else {
                GeldFeld(titel: "Warmwasserkosten separat", wert: heizung.kostenWarmwasserSeparat,
                         hinweis: "bei getrennter Warmwassererzeugung")
            }
        } header: {
            Text("Verteilung nach § 7 und § 8 HeizkostenV")
        } footer: {
            Text("Zulässig sind 50 bis 70 % nach Verbrauch, der Rest als Grundkosten nach Wohnfläche. Seit 2014 ist die Wärmemenge für Warmwasser vorrangig zu messen; die Formelberechnung ist Ersatzlösung.")
        }
    }

    private func co2Abschnitt(_ heizung: Binding<Heizungseinstellungen>) -> some View {
        Section {
            GeldFeld(titel: "CO₂-Kosten laut Rechnung", wert: heizung.co2.kostenCent)
            ZahlFeld(titel: "CO₂-Menge laut Rechnung", wert: heizung.co2.emissionKg,
                     einheit: "kg", nachkomma: 0)
            LabeledContent("Schätzung aus Brennstoffmenge") {
                HStack(spacing: 10) {
                    Text("\(Geld.zahl(schaetzung(heizung.wrappedValue), 0)) kg")
                        .monospacedDigit().foregroundStyle(.secondary)
                    Button("Übernehmen") { speicher.schaetzeCO2() }
                        .buttonStyle(.borderless)
                }
            }
            Picker("Gebäudetyp", selection: heizung.co2.gebaeudetyp) {
                ForEach(Gebaeudetyp.allCases) { typ in
                    Text(typ.bezeichnung).tag(typ)
                }
            }
            Toggle("Ausnahme nach § 9 CO2KostAufG", isOn: heizung.co2.ausnahme)

            if let co2 = speicher.ergebnis?.heizung?.co2, let stufe = co2.stufe {
                Meldung(art: .erfolg,
                        titel: "Stufe \(stufe.nummer): Vermieteranteil \(Geld.zahl(co2.anteilVermieter * 100, 0)) %",
                        text: "Emissionskennwert \(Geld.zahl(co2.kgProM2, 1)) kg CO₂/m²·a. Der Vermieter trägt \(Geld.euro(co2.vermieterCent)), auf die Mieter entfallen \(Geld.euro(co2.mieterCent)).",
                        quelle: "Anlage zu § 5 Abs. 1 CO2KostAufG")
            }

            NavigationLink("Stufenmodell ansehen") { StufenAnsicht(aktiveStufe: speicher.ergebnis?.heizung?.co2.stufe?.nummer) }
        } header: {
            Text("CO₂-Kostenaufteilung")
        } footer: {
            Text("Seit dem 01.01.2023 trägt der Vermieter bei Wohngebäuden je nach Emissionskennwert bis zu 95 % der CO₂-Kosten. Die Brennstoffrechnung muss CO₂-Menge und CO₂-Kosten ausweisen (§ 3 CO2KostAufG).")
        }
    }

    private func ergebnisAbschnitt(_ ergebnis: Heizkosten.Ergebnis) -> some View {
        Section("Berechnungsergebnis") {
            Wertzeile(titel: "Umlagefähige Wärmekosten", wert: Geld.euro(ergebnis.gesamtUmlagefaehig), fett: true)
            if ergebnis.verbunden {
                Wertzeile(titel: "davon Raumheizung", wert: Geld.euro(ergebnis.kostenHeizung))
                Wertzeile(titel: "davon Warmwasser", wert: Geld.euro(ergebnis.kostenWarmwasser))
                Text(ergebnis.warmwasserAufteilung.methode)
                    .font(.caption).foregroundStyle(.secondary)
            }

            ForEach(ergebnis.zeilen) { zeile in
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(zeile.bezeichnung).font(.subheadline)
                        if zeile.leerstand { Merkmal(text: "Leerstand", farbe: .orange) }
                        Spacer()
                        Text(Geld.euro(zeile.summe)).monospacedDigit().fontWeight(.semibold)
                    }
                    Text("Grundkosten \(Geld.euro(zeile.heizGrund + zeile.wwGrund)) · Verbrauchskosten \(Geld.euro(zeile.heizVerbrauch + zeile.wwVerbrauch))")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding(.vertical, 2)
            }
        }
    }

    // MARK: - Hilfen

    private func anteilstext(_ anteil: Double) -> String {
        "\(Geld.zahl(anteil * 100, 0)) % Verbrauch / \(Geld.zahl((1 - anteil) * 100, 0)) % Grundkosten"
    }

    private func schaetzung(_ heizung: Heizungseinstellungen) -> Double {
        CO2.schaetzeEmission(kwh: heizung.brennstoffmenge * heizung.brennstoff.heizwert,
                             brennstoff: heizung.brennstoff)
    }

    /// Der Prozentsatz wird intern als Anteil 0…1 geführt, eingegeben wird in Prozent.
    private func prozentBindung(_ heizung: Binding<Heizungseinstellungen>) -> Binding<Double> {
        Binding(
            get: { heizung.wrappedValue.warmwasser.prozentsatz * 100 },
            set: { heizung.wrappedValue.warmwasser.prozentsatz = $0 / 100 })
    }
}

struct StufenAnsicht: View {
    let aktiveStufe: Int?

    var body: some View {
        List {
            Section {
                ForEach(CO2.stufen, id: \.nummer) { stufe in
                    HStack {
                        Text("Stufe \(stufe.nummer)")
                            .fontWeight(stufe.nummer == aktiveStufe ? .bold : .regular)
                        Spacer()
                        Text("\(stufe.bereichstext) kg/m²·a")
                            .font(.caption).foregroundStyle(.secondary)
                        Text("\(Geld.zahl(stufe.mieter * 100, 0)) / \(Geld.zahl(stufe.vermieter * 100, 0)) %")
                            .monospacedDigit()
                            .frame(width: 96, alignment: .trailing)
                    }
                    .listRowBackground(stufe.nummer == aktiveStufe ? Color.accentColor.opacity(0.12) : nil)
                }
            } header: {
                Text("Mieter / Vermieter")
            } footer: {
                Text("Stufenmodell der Anlage zu § 5 Abs. 1 CO2KostAufG für Wohngebäude.")
            }
        }
        .navigationTitle("CO₂-Stufenmodell")
        .navigationBarTitleDisplayMode(.inline)
    }
}
