import SwiftUI
import WebKit

/// Vorschau und Ausgabe der Abrechnung: Bildschirmvorschau in einer Webansicht,
/// PDF-Erzeugung im A4-Format, Teilen und Drucken.
struct DokumentAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher

    private enum Auswahl: Hashable {
        case alle
        case mieter(String)
        case intern
    }

    @State private var auswahl: Auswahl = .alle
    @State private var pdfDatei: URL?
    @State private var erzeugt = false
    @State private var fehlertext: String?
    @State private var erzeuger = PDFErzeuger()

    var body: some View {
        Group {
            if let index = speicher.aktiverIndex, let ergebnis = speicher.ergebnis {
                inhalt(index, ergebnis)
            } else {
                KeinZeitraum()
            }
        }
        .alert("PDF konnte nicht erstellt werden",
               isPresented: Binding(get: { fehlertext != nil }, set: { if !$0 { fehlertext = nil } })) {
            Button("OK", role: .cancel) { fehlertext = nil }
        } message: {
            Text(fehlertext ?? "")
        }
    }

    @ViewBuilder
    private func inhalt(_ index: Int, _ ergebnis: Abrechnung.Ergebnis) -> some View {
        let periode = speicher.daten.abrechnungen[index]
        let html = html(periode, ergebnis)

        VStack(spacing: 0) {
            steuerleiste(index, periode, ergebnis)
            Divider()
            Webvorschau(html: html)
        }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                if let pdfDatei {
                    ShareLink(item: pdfDatei) {
                        Label("Teilen", systemImage: "square.and.arrow.up")
                    }
                }
                Button {
                    erzeugePDF(html: html, name: dateiname(periode))
                } label: {
                    Label(erzeugt ? "PDF neu erstellen" : "PDF erstellen", systemImage: "doc.badge.arrow.up")
                }
            }
        }
    }

    @ViewBuilder
    private func steuerleiste(_ index: Int, _ periode: Abrechnungszeitraum, _ ergebnis: Abrechnung.Ergebnis) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let pruefung = speicher.pruefung, pruefung.fehler > 0 {
                Meldung(art: .fehler,
                        titel: "\(pruefung.fehler) Fehler in der Rechtsprüfung",
                        text: "Das Dokument wird trotzdem erzeugt, sollte aber vor dem Versand korrigiert werden.")
            }

            Picker("Anzeigen", selection: $auswahl) {
                Text("Alle Mieterabrechnungen").tag(Auswahl.alle)
                ForEach(ergebnis.ergebnisse) { eintrag in
                    Text("\(eintrag.einheit?.bezeichnung ?? "") – \(eintrag.mieterName)")
                        .tag(Auswahl.mieter(eintrag.mietverhaeltnisId))
                }
                Text("Interne Kostenübersicht").tag(Auswahl.intern)
            }
            .pickerStyle(.menu)

            DisclosureGroup("Zeitraum und Fristen") {
                DatumFeld(titel: "Abrechnungszeitraum von",
                          wert: $speicher.daten.abrechnungen[index].von)
                DatumFeld(titel: "bis", wert: $speicher.daten.abrechnungen[index].bis,
                          hinweis: "\(periode.tage) Tage")
                DatumFeld(titel: "Erstellt am", wert: $speicher.daten.abrechnungen[index].erstelltAm,
                          optional: true, hinweis: "Datum im Briefkopf")
                DatumFeld(titel: "Zugestellt am", wert: $speicher.daten.abrechnungen[index].zugestelltAm,
                          optional: true,
                          hinweis: "Abrechnungsfrist endet am \(Datum.deutsch(periode.abrechnungsfrist))")
                Stepper("Zahlungsfrist: \(periode.zahlungsfristTage) Tage",
                        value: $speicher.daten.abrechnungen[index].zahlungsfristTage,
                        in: 0...120, step: 5)
            }
            .font(.subheadline)

            if let pdfDatei {
                HStack(spacing: 12) {
                    Label("PDF bereit", systemImage: "checkmark.circle.fill")
                        .font(.footnote).foregroundStyle(.green)
                    Button("Drucken") {
                        if let daten = try? Data(contentsOf: pdfDatei) {
                            PDFAusgabe.drucke(daten, name: pdfDatei.deletingPathExtension().lastPathComponent)
                        }
                    }
                    .font(.footnote)
                }
            }
        }
        .padding()
    }

    // MARK: - Dokument und Ausgabe

    private func html(_ periode: Abrechnungszeitraum, _ ergebnis: Abrechnung.Ergebnis) -> String {
        switch auswahl {
        case .alle:
            return DokumentHTML.alleMieterdokumente(speicher.daten, periode, ergebnis)
        case .intern:
            return DokumentHTML.vermieteruebersicht(speicher.daten, periode, ergebnis)
        case .mieter(let id):
            guard let eintrag = ergebnis.ergebnisse.first(where: { $0.mietverhaeltnisId == id }) else {
                return DokumentHTML.alleMieterdokumente(speicher.daten, periode, ergebnis)
            }
            return DokumentHTML.mieterdokument(speicher.daten, periode, ergebnis, eintrag)
        }
    }

    private func dateiname(_ periode: Abrechnungszeitraum) -> String {
        switch auswahl {
        case .alle:
            return "Betriebskostenabrechnung \(periode.jahr)"
        case .intern:
            return "Interne Kostenübersicht \(periode.jahr)"
        case .mieter(let id):
            let name = speicher.ergebnis?.ergebnisse.first { $0.mietverhaeltnisId == id }?.mieterName ?? "Mieter"
            return "Betriebskostenabrechnung \(periode.jahr) – \(name)"
        }
    }

    private func erzeugePDF(html: String, name: String) {
        pdfDatei = nil
        erzeuger.erzeuge(html: html) { ergebnis in
            switch ergebnis {
            case .success(let daten):
                do {
                    pdfDatei = try PDFAusgabe.schreibe(daten, name: name)
                    erzeugt = true
                } catch {
                    fehlertext = error.localizedDescription
                }
            case .failure(let fehler):
                fehlertext = fehler.localizedDescription
            }
        }
    }
}

/// Zeigt das Abrechnungs-HTML unverändert an – die Vorschau entspricht damit
/// exakt der späteren PDF-Ausgabe.
struct Webvorschau: UIViewRepresentable {
    let html: String

    func makeUIView(context: Context) -> WKWebView {
        let ansicht = WKWebView()
        ansicht.isOpaque = true
        ansicht.backgroundColor = .white
        ansicht.scrollView.backgroundColor = .white
        return ansicht
    }

    func updateUIView(_ ansicht: WKWebView, context: Context) {
        guard context.coordinator.zuletzt != html else { return }
        context.coordinator.zuletzt = html
        ansicht.loadHTMLString(html, baseURL: nil)
    }

    func makeCoordinator() -> Koordinator { Koordinator() }

    final class Koordinator {
        var zuletzt: String?
    }
}
