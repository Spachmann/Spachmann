import Foundation
import Combine

/// Hält den Datenbestand, sichert ihn auf dem Gerät und berechnet
/// Abrechnungsergebnis und Rechtsprüfung neu, sobald sich etwas ändert.
///
/// Die Daten verbleiben ausschließlich lokal; es findet keine Übertragung an
/// Server statt.
@MainActor
final class Datenspeicher: ObservableObject {

    @Published var daten: Datenbestand { didSet { nachAenderung() } }
    @Published var aktiveAbrechnungId: String? { didSet { aktualisiere(); sichereSofort() } }

    @Published private(set) var ergebnis: Abrechnung.Ergebnis?
    @Published private(set) var pruefung: Pruefung.Ergebnis?
    @Published private(set) var letzterFehler: String?

    private var sicherungsaufgabe: Task<Void, Never>?

    // MARK: - Ablageort

    private static let dateiname = "nebenkosten.json"
    private static let auswahlSchluessel = "nebenkosten.aktiveAbrechnung"

    private static var ablage: URL {
        let verzeichnis = (try? FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? FileManager.default.temporaryDirectory
        return verzeichnis.appendingPathComponent(dateiname)
    }

    // MARK: - Aufbau

    init(daten: Datenbestand? = nil) {
        if let daten {
            self.daten = daten
        } else {
            self.daten = Self.lade() ?? Datenbestand()
        }
        self.aktiveAbrechnungId = UserDefaults.standard.string(forKey: Self.auswahlSchluessel)
            ?? self.daten.abrechnungen.first?.id
        aktualisiere()
    }

    private static func lade() -> Datenbestand? {
        guard let roh = try? Data(contentsOf: ablage) else { return nil }
        return try? JSONDecoder().decode(Datenbestand.self, from: roh)
    }

    // MARK: - Sichern

    private func nachAenderung() {
        aktualisiere()
        planeSicherung()
    }

    /// Sammelt schnelle Folgeänderungen (Tippen) zu einem Schreibvorgang.
    private func planeSicherung() {
        sicherungsaufgabe?.cancel()
        sicherungsaufgabe = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }
            self?.sichereSofort()
        }
    }

    func sichereSofort() {
        do {
            let kodierer = JSONEncoder()
            kodierer.outputFormatting = [.prettyPrinted, .sortedKeys]
            try kodierer.encode(daten).write(to: Self.ablage, options: .atomic)
            UserDefaults.standard.set(aktiveAbrechnungId, forKey: Self.auswahlSchluessel)
            letzterFehler = nil
        } catch {
            letzterFehler = "Sichern fehlgeschlagen: \(error.localizedDescription)"
        }
    }

    // MARK: - Berechnung

    private func aktualisiere() {
        guard let periode = aktiveAbrechnung, !daten.einheiten.isEmpty else {
            ergebnis = nil
            pruefung = nil
            return
        }
        let berechnet = Abrechnung.berechne(daten, periode)
        ergebnis = berechnet
        pruefung = Pruefung.pruefe(daten, periode, berechnet)
    }

    // MARK: - Abrechnungszeiträume

    var aktiverIndex: Int? {
        guard !daten.abrechnungen.isEmpty else { return nil }
        if let id = aktiveAbrechnungId, let index = daten.abrechnungen.firstIndex(where: { $0.id == id }) {
            return index
        }
        return 0
    }

    var aktiveAbrechnung: Abrechnungszeitraum? {
        guard let index = aktiverIndex else { return nil }
        return daten.abrechnungen[index]
    }

    @discardableResult
    func legeAbrechnungAn(jahr: Int) -> Abrechnungszeitraum {
        let neu = Abrechnungszeitraum(jahr: jahr)
        daten.abrechnungen.append(neu)
        daten.abrechnungen.sort { $0.jahr > $1.jahr }
        aktiveAbrechnungId = neu.id
        return neu
    }

    func loescheAbrechnung(id: String) {
        daten.abrechnungen.removeAll { $0.id == id }
        if aktiveAbrechnungId == id { aktiveAbrechnungId = daten.abrechnungen.first?.id }
    }

    // MARK: - Stammdaten

    func legeEinheitAn() {
        daten.einheiten.append(Einheit(bezeichnung: "Wohnung \(daten.einheiten.count + 1)"))
        if daten.objekt.wohnflaecheGesamt <= 0 {
            daten.objekt.wohnflaecheGesamt = daten.summeWohnflaechen
        }
    }

    func loescheEinheit(id: String) {
        daten.einheiten.removeAll { $0.id == id }
        daten.mietverhaeltnisse.removeAll { $0.einheitId == id }
        for index in daten.abrechnungen.indices {
            daten.abrechnungen[index].verbraeuche.removeAll { $0.einheitId == id }
        }
    }

    func legeMietverhaeltnisAn() {
        guard let ersteEinheit = daten.einheiten.first else { return }
        let jahr = aktiveAbrechnung?.jahr ?? Datum.jahr(von: Datum.heute())
        daten.mietverhaeltnisse.append(Mietverhaeltnis(einheitId: ersteEinheit.id, jahr: jahr))
    }

    func loescheMietverhaeltnis(id: String) {
        daten.mietverhaeltnisse.removeAll { $0.id == id }
        for index in daten.abrechnungen.indices {
            daten.abrechnungen[index].verbraeuche.removeAll { $0.mietverhaeltnisId == id }
        }
    }

    func legePositionAn() {
        guard let index = aktiverIndex else { return }
        daten.abrechnungen[index].positionen.append(Position())
    }

    func loeschePosition(id: String) {
        guard let index = aktiverIndex else { return }
        daten.abrechnungen[index].positionen.removeAll { $0.id == id }
    }

    func uebernehmeWohnflaeche() {
        daten.objekt.wohnflaecheGesamt = daten.summeWohnflaechen
    }

    /// Schätzt die CO₂-Menge aus Brennstoffmenge und Heizwert.
    func schaetzeCO2() {
        guard let index = aktiverIndex else { return }
        let h = daten.abrechnungen[index].heizung
        let kwh = h.brennstoffmenge * h.brennstoff.heizwert
        let kg = CO2.schaetzeEmission(kwh: kwh, brennstoff: h.brennstoff)
        guard kg > 0 else { return }
        daten.abrechnungen[index].heizung.co2.emissionKg = (kg).rounded()
    }

    // MARK: - Sicherung und Wiederherstellung

    struct Sicherung: Codable {
        var exportiertAm: String
        var daten: Datenbestand
    }

    /// Erzeugt eine Sicherungsdatei im selben Format wie die Web-Fassung.
    func sicherungsdatei() throws -> URL {
        let kodierer = JSONEncoder()
        kodierer.outputFormatting = [.prettyPrinted, .sortedKeys]
        let inhalt = Sicherung(exportiertAm: ISO8601DateFormatter().string(from: Date()), daten: daten)
        let ziel = FileManager.default.temporaryDirectory
            .appendingPathComponent("nebenkosten-sicherung-\(Datum.heute()).json")
        try kodierer.encode(inhalt).write(to: ziel, options: .atomic)
        return ziel
    }

    /// Liest eine Sicherung – sowohl das umhüllte Format als auch einen
    /// unmittelbar gespeicherten Datenbestand.
    func stelleWiederHer(von url: URL) throws {
        let braucht = url.startAccessingSecurityScopedResource()
        defer { if braucht { url.stopAccessingSecurityScopedResource() } }

        let roh = try Data(contentsOf: url)
        let dekodierer = JSONDecoder()

        if let sicherung = try? dekodierer.decode(Sicherung.self, from: roh) {
            daten = sicherung.daten
        } else {
            daten = try dekodierer.decode(Datenbestand.self, from: roh)
        }
        aktiveAbrechnungId = daten.abrechnungen.first?.id
        sichereSofort()
    }

    func ladeDemodaten() {
        daten = Demodaten.erzeuge()
        aktiveAbrechnungId = daten.abrechnungen.first?.id
        sichereSofort()
    }

    func setzeZurueck() {
        daten = Datenbestand()
        aktiveAbrechnungId = nil
        sichereSofort()
    }
}
