import SwiftUI

struct PruefungAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher

    var body: some View {
        Group {
            if let pruefung = speicher.pruefung, let periode = speicher.aktiveAbrechnung {
                inhalt(pruefung, periode)
            } else {
                KeinZeitraum()
            }
        }
    }

    @ViewBuilder
    private func inhalt(_ pruefung: Pruefung.Ergebnis, _ periode: Abrechnungszeitraum) -> some View {
        Form {
            Section {
                if pruefung.abrechnungsfaehig {
                    Meldung(art: .erfolg,
                            titel: "Formelle Mindestanforderungen erfüllt",
                            text: "Zusammenstellung der Gesamtkosten, Angabe und Erläuterung der Verteilerschlüssel, Berechnung des Mieteranteils und Abzug der Vorauszahlungen sind vorhanden.",
                            quelle: "BGH VIII ZR 84/07")
                } else {
                    Meldung(art: .fehler,
                            titel: "Abrechnung noch nicht versandfertig",
                            text: "Behebe zuerst die aufgeführten Fehler.")
                }

                Kennzahlenraster {
                    Kennzahl(titel: "Fehler", wert: String(pruefung.fehler),
                             zusatz: "verhindern die Wirksamkeit",
                             farbe: pruefung.fehler > 0 ? .red : .green)
                    Kennzahl(titel: "Warnungen", wert: String(pruefung.warnungen),
                             zusatz: "rechtlich riskant")
                    Kennzahl(titel: "Hinweise", wert: String(pruefung.hinweise),
                             zusatz: "zur Vollständigkeit")
                }
            }
            .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
            .listRowBackground(Color.clear)

            ForEach(Pruefung.Stufe.allCases) { stufe in
                let befunde = pruefung.gefiltert(stufe)
                if !befunde.isEmpty {
                    Section("\(stufe.titel) (\(befunde.count))") {
                        ForEach(befunde) { befund in
                            Meldung(art: art(stufe),
                                    titel: befund.titel,
                                    text: befund.text,
                                    quelle: befund.quelle)
                        }
                    }
                    .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                    .listRowBackground(Color.clear)
                }
            }

            Section("Formelle Mindestanforderungen") {
                anforderung("Zusammenstellung der Gesamtkosten je Kostenart",
                            "BGH VIII ZR 84/07", !periode.positionen.isEmpty)
                anforderung("Angabe und Erläuterung des Verteilerschlüssels",
                            "§ 556a BGB", true)
                anforderung("Berechnung des Anteils des Mieters",
                            "BGH VIII ZR 84/07", true)
                anforderung("Abzug der geleisteten Vorauszahlungen",
                            "BGH VIII ZR 84/07", true)
                anforderung("Abrechnungszeitraum höchstens zwölf Monate",
                            "§ 556 Abs. 3 Satz 1 BGB", periode.tage <= 366)
                anforderung("Zugang innerhalb der Abrechnungsfrist",
                            "§ 556 Abs. 3 Satz 2 und 3 BGB", fristGewahrt(periode))
                anforderung("Trennung umlagefähiger und nicht umlagefähiger Kosten",
                            "§ 1 Abs. 2, § 2 BetrKV", true)
                anforderung("Heizkosten verbrauchsabhängig (50 bis 70 %)",
                            "§§ 7, 8 HeizkostenV",
                            !periode.heizung.aktiv || Heizkosten.verbrauchsanteilZulaessig(periode.heizung.anteilVerbrauchHeizung))
            }

            Section {
                Text("Die automatische Prüfung deckt typische Fehlerquellen ab. Ob eine Kostenart im konkreten Fall umgelegt werden darf, richtet sich stets zusätzlich nach dem Mietvertrag. Sie ersetzt keine rechtliche Beratung.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    private func fristGewahrt(_ periode: Abrechnungszeitraum) -> Bool {
        guard !periode.zugestelltAm.isEmpty,
              let zugestellt = Datum.tagesnummer(periode.zugestelltAm),
              let frist = Datum.tagesnummer(periode.abrechnungsfrist)
        else { return true }
        return zugestellt <= frist
    }

    private func art(_ stufe: Pruefung.Stufe) -> Meldung.Art {
        switch stufe {
        case .fehler: return .fehler
        case .warnung: return .warnung
        case .hinweis: return .hinweis
        }
    }

    private func anforderung(_ text: String, _ quelle: String, _ erfuellt: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: erfuellt ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(erfuellt ? .green : .red)
            VStack(alignment: .leading, spacing: 1) {
                Text(text).font(.subheadline)
                Text(quelle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
    }
}
