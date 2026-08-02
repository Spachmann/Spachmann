import SwiftUI

// MARK: - Eingabefelder

/// Eingabefeld für Geldbeträge. Gerechnet wird in Cent, angezeigt und
/// eingegeben wird in deutscher Schreibweise („1.234,56“).
struct GeldFeld: View {
    let titel: String
    @Binding var wert: Cent
    var hinweis: String?

    @State private var rohtext: String?

    private var text: Binding<String> {
        Binding(
            get: { rohtext ?? Geld.betragText(wert) },
            set: { neu in
                rohtext = neu
                wert = Geld.parse(neu)
            })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            LabeledContent(titel) {
                HStack(spacing: 4) {
                    TextField("0,00", text: text)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                    Text("€").foregroundStyle(.secondary)
                }
            }
            if let hinweis {
                Text(hinweis).font(.caption).foregroundStyle(.secondary)
            }
        }
        .onDisappear { rohtext = nil }
    }
}

/// Eingabefeld für Dezimalzahlen wie Flächen oder Verbräuche.
struct ZahlFeld: View {
    let titel: String
    @Binding var wert: Double
    var einheit: String = ""
    var nachkomma: Int = 2
    var hinweis: String?

    @State private var rohtext: String?

    private var text: Binding<String> {
        Binding(
            get: { rohtext ?? Geld.zahl(wert, nachkomma) },
            set: { neu in
                rohtext = neu
                wert = Geld.parseZahl(neu)
            })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            LabeledContent(titel) {
                HStack(spacing: 4) {
                    TextField("0", text: text)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                    if !einheit.isEmpty {
                        Text(einheit).foregroundStyle(.secondary)
                    }
                }
            }
            if let hinweis {
                Text(hinweis).font(.caption).foregroundStyle(.secondary)
            }
        }
        .onDisappear { rohtext = nil }
    }
}

/// Datumsfeld, das intern mit ISO-Zeichenketten arbeitet und leere Werte zulässt.
struct DatumFeld: View {
    let titel: String
    @Binding var wert: String
    var optional: Bool = false
    var hinweis: String?

    /// Umrechnung über Kalenderbestandteile statt über Zeitstempel – sonst
    /// verschiebt die Zeitzone das Datum um einen Tag.
    private var datum: Binding<Date> {
        Binding(
            get: {
                guard let teile = Datum.teile(wert) else { return Date() }
                var bestandteile = DateComponents()
                bestandteile.year = teile.jahr
                bestandteile.month = teile.monat
                bestandteile.day = teile.tag
                bestandteile.hour = 12
                return Calendar.current.date(from: bestandteile) ?? Date()
            },
            set: { neu in
                let bestandteile = Calendar.current.dateComponents([.year, .month, .day], from: neu)
                guard let jahr = bestandteile.year,
                      let monat = bestandteile.month,
                      let tag = bestandteile.day else { return }
                wert = String(format: "%04d-%02d-%02d", jahr, monat, tag)
            })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if optional && wert.isEmpty {
                LabeledContent(titel) {
                    Button("Datum setzen") { wert = Datum.heute() }
                        .buttonStyle(.borderless)
                }
            } else {
                HStack {
                    DatePicker(titel, selection: datum, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "de_DE"))
                    if optional {
                        Button {
                            wert = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Datum entfernen")
                    }
                }
            }
            if let hinweis {
                Text(hinweis).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Anzeigebausteine

/// Kennzahl mit Titel, Wert und Zusatzzeile.
struct Kennzahl: View {
    let titel: String
    let wert: String
    var zusatz: String = ""
    var farbe: Color = .primary

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(titel.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(wert)
                .font(.title2.weight(.semibold))
                .foregroundStyle(farbe)
                .monospacedDigit()
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            if !zusatz.isEmpty {
                Text(zusatz).font(.caption).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

/// Raster aus Kennzahlen, das sich an die Breite anpasst.
struct Kennzahlenraster<Inhalt: View>: View {
    @ViewBuilder let inhalt: Inhalt

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 165), spacing: 12)], spacing: 12) {
            inhalt
        }
    }
}

/// Farbig hinterlegter Hinweis mit Rechtsgrundlage.
struct Meldung: View {
    enum Art { case fehler, warnung, hinweis, erfolg }

    let art: Art
    let titel: String
    let text: String
    var quelle: String = ""

    private var farbe: Color {
        switch art {
        case .fehler: return .red
        case .warnung: return .orange
        case .hinweis: return .blue
        case .erfolg: return .green
        }
    }

    private var symbol: String {
        switch art {
        case .fehler: return "exclamationmark.octagon.fill"
        case .warnung: return "exclamationmark.triangle.fill"
        case .hinweis: return "info.circle.fill"
        case .erfolg: return "checkmark.circle.fill"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol).foregroundStyle(farbe)
            VStack(alignment: .leading, spacing: 3) {
                Text(titel).font(.subheadline.weight(.semibold))
                Text(text).font(.footnote).fixedSize(horizontal: false, vertical: true)
                if !quelle.isEmpty {
                    Text(quelle).font(.caption2).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(farbe.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
    }
}

/// Kleine farbige Markierung, etwa „umlagefähig“.
struct Merkmal: View {
    let text: String
    var farbe: Color = .secondary

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(farbe.opacity(0.15), in: Capsule())
            .foregroundStyle(farbe)
    }
}

/// Zeile mit Beschriftung links und Wert rechts.
struct Wertzeile: View {
    let titel: String
    let wert: String
    var fett: Bool = false
    var farbe: Color = .primary

    var body: some View {
        HStack {
            Text(titel)
            Spacer()
            Text(wert)
                .monospacedDigit()
                .foregroundStyle(farbe)
                .fontWeight(fett ? .semibold : .regular)
        }
    }
}

/// Platzhalter, wenn noch keine Daten erfasst wurden.
struct Leerzustand: View {
    let symbol: String
    let titel: String
    let text: String
    var aktionstitel: String?
    var aktion: (() -> Void)?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: symbol).font(.largeTitle).foregroundStyle(.secondary)
            Text(titel).font(.headline)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 420)
            if let aktionstitel, let aktion {
                Button(aktionstitel, action: aktion).buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
    }
}
