import Foundation
import UIKit
import WebKit

/// Erzeugt aus dem HTML-Dokument eine PDF-Datei im A4-Format.
///
/// Der Weg über `UIPrintPageRenderer` liefert – anders als ein Bildschirmfoto
/// der Webansicht – eine echte Mehrseiten-Paginierung und berücksichtigt die
/// Seitenumbruchregeln des Stylesheets.
final class PDFErzeuger: NSObject, WKNavigationDelegate {

    /// DIN A4 in typografischen Punkten (72 dpi).
    static let a4 = CGRect(x: 0, y: 0, width: 595.28, height: 841.89)

    enum Fehler: LocalizedError {
        case ladefehler(String)

        var errorDescription: String? {
            switch self {
            case .ladefehler(let text): return "Das Dokument konnte nicht aufgebaut werden: \(text)"
            }
        }
    }

    private var webansicht: WKWebView?
    private var abschluss: ((Result<Data, Error>) -> Void)?

    /// Baut das HTML auf und liefert die fertige PDF-Datei zurück.
    /// Muss auf dem Hauptthread aufgerufen werden.
    func erzeuge(html: String, abschluss: @escaping (Result<Data, Error>) -> Void) {
        self.abschluss = abschluss

        let konfiguration = WKWebViewConfiguration()
        let ansicht = WKWebView(frame: Self.a4, configuration: konfiguration)
        ansicht.navigationDelegate = self
        ansicht.isOpaque = true
        ansicht.backgroundColor = .white
        webansicht = ansicht
        ansicht.loadHTMLString(html, baseURL: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Dem Layout einen Moment geben, bevor gedruckt wird.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            guard let self, let abschluss = self.abschluss else { return }
            let daten = Self.drucke(webView)
            self.abschluss = nil
            self.webansicht = nil
            abschluss(.success(daten))
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        melde(fehler: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        melde(fehler: error)
    }

    private func melde(fehler: Error) {
        let abschluss = self.abschluss
        self.abschluss = nil
        webansicht = nil
        abschluss?(.failure(Fehler.ladefehler(fehler.localizedDescription)))
    }

    /// Rendert den Inhalt der Webansicht seitenweise in ein PDF.
    private static func drucke(_ webView: WKWebView) -> Data {
        let renderer = UIPrintPageRenderer()
        renderer.addPrintFormatter(webView.viewPrintFormatter(), startingAtPageAt: 0)

        // Die Ränder stammen aus dem Stylesheet, deshalb ist die bedruckbare
        // Fläche mit dem Blattformat identisch.
        renderer.setValue(NSValue(cgRect: a4), forKey: "paperRect")
        renderer.setValue(NSValue(cgRect: a4), forKey: "printableRect")

        let daten = NSMutableData()
        UIGraphicsBeginPDFContextToData(daten, a4, nil)
        let seiten = max(1, renderer.numberOfPages)
        renderer.prepare(forDrawingPages: NSRange(location: 0, length: seiten))
        for seite in 0..<seiten {
            UIGraphicsBeginPDFPage()
            renderer.drawPage(at: seite, in: UIGraphicsGetPDFContextBounds())
        }
        UIGraphicsEndPDFContext()
        return daten as Data
    }
}

// MARK: - Ausgabe

enum PDFAusgabe {

    /// Schreibt die PDF-Daten in eine Datei mit sprechendem Namen.
    static func schreibe(_ daten: Data, name: String) throws -> URL {
        let sicher = name
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
        let ziel = FileManager.default.temporaryDirectory.appendingPathComponent("\(sicher).pdf")
        try daten.write(to: ziel, options: .atomic)
        return ziel
    }

    /// Öffnet den Systemdruckdialog, aus dem heraus sich auch AirPrint nutzen lässt.
    static func drucke(_ daten: Data, name: String) {
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = name
        info.orientation = .portrait

        let steuerung = UIPrintInteractionController.shared
        steuerung.printInfo = info
        steuerung.printingItem = daten
        steuerung.present(animated: true, completionHandler: nil)
    }
}
