import Foundation
import Combine

/// Hält den Datenbestand, sichert ihn auf dem Gerät und berechnet
/// Abrechnungsergebnis und Rechtsprüfung neu, sobald sich etwas ändert.
///
/// Der Bestand kann mehrere Vermieter mit jeweils mehreren Objekten enthalten.
/// Gearbeitet wird immer auf einem ausgewählten Objekt; `bestand` liefert dazu
/// den passenden Ausschnitt für Abrechnung, Prüfung und Dokument.
///
/// Die Daten verbleiben ausschließlich lokal; es findet keine Übertragung an
/// Server statt.
@MainActor
final class Datenspeicher: ObservableObject {

    @Published var daten: Datenbestand { didSet { nachAenderung() } }
    @Published var aktivesObjektId: String? { didSet { objektGewechselt() } }
    @Published var aktiveAbrechnungId: String? { didSet { aktualisiere(); sichereSofort() } }

    @Published private(set) var ergebnis: Abrechnung.Ergebnis?
    @Published private(set) var pruefung: Pruefung.Ergebnis?
    @Published private(set) var letzterFehler: String?

    private var sicherungsaufgabe: Task<Void, Never>?

    // MARK: - Ablageort

    private static let dateiname = "nebenkosten.json"
    private static let objektSchluessel = "nebenkosten.aktivesObjekt"
    private static let abrechnungSchluessel = "nebenkosten.aktiveAbrechnung"

    private static var ablage: URL {
        let verzeichnis = (try? FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? FileManager.default.temporaryDirectory
        return verzeichnis.appendingPathComponent(dateiname)
    }

    // MARK: - Aufbau

    init(daten: Datenbestand? = nil) {
        self.daten = daten ?? Self.lade() ?? Datenbestand()
        self.aktivesObjektId = UserDefaults.standard.string(forKey: Self.objektSchluessel)
        self.aktiveAbrechnungId = UserDefaults.standard.string(forKey: Self.abrechnungSchluessel)
        richteAuswahlAus()
        aktualisiere()
    }

    private static func lade() -> Datenbestand? {
        guard let roh = try? Data(contentsOf: ablage) else { return nil }
        return try? JSONDecoder().decode(Datenbestand.self, from: roh)
    }

    /// Sorgt dafür, dass Objekt- und Zeitraumauswahl auf vorhandene Einträge zeigen.
    private func richteAuswahlAus() {
        if aktivesObjektId == nil || !daten.objekte.contains(where: { $0.id == aktivesObjektId }) {
            aktivesObjektId = daten.objekte.first?.id
        }
        let zeitraeume = self.zeitraeume
        if aktiveAbrechnungId == nil || !zeitraeume.contains(where: { $0.id == aktiveAbrechnungId }) {
            aktiveAbrechnungId = zeitraeume.first?.id
        }
    }

    // MARK: - Sichern

    private func nachAenderung() {
        aktualisiere()
        planeSicherung()
    }

    private func objektGewechselt() {
        let zeitraeume = self.zeitraeume
        if !zeitraeume.contains(where: { $0.id == aktiveAbrechnungId }) {
            aktiveAbrechnungId = zeitraeume.first?.id
        } else {
            aktualisiere()
        }
        sichereSofort()
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
            UserDefaults.standard.set(aktivesObjektId, forKey: Self.objektSchluessel)
            UserDefaults.standard.set(aktiveAbrechnungId, forKey: Self.abrechnungSchluessel)
            letzterFehler = nil
        } catch {
            letzterFehler = "Sichern fehlgeschlagen: \(error.localizedDescription)"
        }
    }

    // MARK: - Berechnung

    private func aktualisiere() {
        guard let bestand, let periode = aktiveAbrechnung, !bestand.einheiten.isEmpty else {
            ergebnis = nil
            pruefung = nil
            return
        }
        let berechnet = Abrechnung.berechne(bestand, periode)
        ergebnis = berechnet
        pruefung = Pruefung.pruefe(bestand, periode, berechnet)
    }

    // MARK: - Auswahl

    var aktivesObjekt: Objekt? {
        guard let id = aktivesObjektId else { return nil }
        return daten.objektMit(id: id)
    }

    /// Ausschnitt des Bestands für das aktive Objekt.
    var bestand: Objektbestand? {
        guard let id = aktivesObjektId else { return nil }
        return daten.bestand(fuerObjekt: id)
    }

    /// Abrechnungszeiträume des aktiven Objekts, neueste zuerst.
    var zeitraeume: [Abrechnungszeitraum] {
        guard let id = aktivesObjektId else { return [] }
        return daten.abrechnungenZu(objektId: id)
    }

    var aktiverIndex: Int? {
        guard let id = aktiveAbrechnungId else { return nil }
        return daten.abrechnungen.firstIndex { $0.id == id }
    }

    var aktiveAbrechnung: Abrechnungszeitraum? {
        guard let index = aktiverIndex else { return nil }
        return daten.abrechnungen[index]
    }

    var einheiten: [Einheit] {
        guard let id = aktivesObjektId else { return [] }
        return daten.einheitenZu(objektId: id)
    }

    var mietverhaeltnisse: [Mietverhaeltnis] {
        guard let id = aktivesObjektId else { return [] }
        return daten.mietverhaeltnisseZu(objektId: id)
    }

    // MARK: - Vermieter

    @discardableResult
    func legeVermieterAn(name: String = "") -> Vermieter {
        let neu = Vermieter(name: name)
        daten.vermieter.append(neu)
        return neu
    }

    func loescheVermieter(id: String) {
        for objekt in daten.objekteZu(vermieterId: id) { entferneObjekt(objekt.id) }
        daten.vermieter.removeAll { $0.id == id }
        richteAuswahlAus()
    }

    // MARK: - Objekte

    @discardableResult
    func legeObjektAn(vermieterId: String? = nil, bezeichnung: String = "") -> Objekt? {
        let eigentuemer = vermieterId ?? aktivesObjekt?.vermieterId ?? daten.vermieter.first?.id
        guard let eigentuemer else { return nil }
        let name = bezeichnung.isEmpty ? "Objekt \(daten.objekte.count + 1)" : bezeichnung
        let neu = Objekt(vermieterId: eigentuemer, bezeichnung: name)
        daten.objekte.append(neu)
        aktivesObjektId = neu.id
        return neu
    }

    func loescheObjekt(id: String) {
        entferneObjekt(id)
        richteAuswahlAus()
    }

    private func entferneObjekt(_ objektId: String) {
        let einheitIds = Set(daten.einheitenZu(objektId: objektId).map(\.id))
        daten.objekte.removeAll { $0.id == objektId }
        daten.einheiten.removeAll { $0.objektId == objektId }
        daten.mietverhaeltnisse.removeAll { einheitIds.contains($0.einheitId) }
        daten.abrechnungen.removeAll { $0.objektId == objektId }
    }

    func uebernehmeWohnflaeche(objektId: String? = nil) {
        guard let id = objektId ?? aktivesObjektId,
              let index = daten.objekte.firstIndex(where: { $0.id == id }) else { return }
        daten.objekte[index].wohnflaecheGesamt = daten.einheitenZu(objektId: id).map(\.wohnflaeche).summe
    }

    // MARK: - Einheiten und Mietverhältnisse

    func legeEinheitAn() {
        guard let objektId = aktivesObjektId else { return }
        daten.einheiten.append(Einheit(objektId: objektId, bezeichnung: "Wohnung \(einheiten.count + 1)"))
        if let index = daten.objekte.firstIndex(where: { $0.id == objektId }),
           daten.objekte[index].wohnflaecheGesamt <= 0 {
            daten.objekte[index].wohnflaecheGesamt = daten.einheitenZu(objektId: objektId).map(\.wohnflaeche).summe
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
        guard let ersteEinheit = einheiten.first else { return }
        let jahr = aktiveAbrechnung?.jahr ?? Datum.jahr(von: Datum.heute())
        daten.mietverhaeltnisse.append(Mietverhaeltnis(einheitId: ersteEinheit.id, jahr: jahr))
    }

    func loescheMietverhaeltnis(id: String) {
        daten.mietverhaeltnisse.removeAll { $0.id == id }
        for index in daten.abrechnungen.indices {
            daten.abrechnungen[index].verbraeuche.removeAll { $0.mietverhaeltnisId == id }
        }
    }

    // MARK: - Kostenpositionen

    func legePositionAn() {
        guard let index = aktiverIndex else { return }
        daten.abrechnungen[index].positionen.append(Position())
    }

    func loeschePosition(id: String) {
        guard let index = aktiverIndex else { return }
        daten.abrechnungen[index].positionen.removeAll { $0.id == id }
    }

    /// Schätzt die CO₂-Menge aus Brennstoffmenge und Heizwert.
    func schaetzeCO2() {
        guard let index = aktiverIndex else { return }
        let h = daten.abrechnungen[index].heizung
        let kwh = h.brennstoffmenge * h.brennstoff.heizwert
        let kg = CO2.schaetzeEmission(kwh: kwh, brennstoff: h.brennstoff)
        guard kg > 0 else { return }
        daten.abrechnungen[index].heizung.co2.emissionKg = kg.rounded()
    }

    // MARK: - Abrechnungszeiträume

    @discardableResult
    func legeAbrechnungAn(jahr: Int) -> Abrechnungszeitraum? {
        guard let objektId = aktivesObjektId else { return nil }
        let neu = Abrechnungszeitraum(objektId: objektId, jahr: jahr)
        daten.abrechnungen.append(neu)
        aktiveAbrechnungId = neu.id
        return neu
    }

    func loescheAbrechnung(id: String) {
        daten.abrechnungen.removeAll { $0.id == id }
        richteAuswahlAus()
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
    /// unmittelbar gespeicherten Datenbestand, auch in der Fassung 1.
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
        aktivesObjektId = nil
        aktiveAbrechnungId = nil
        richteAuswahlAus()
        aktualisiere()
        sichereSofort()
    }

    func ladeDemodaten() {
        daten = Demodaten.erzeuge()
        aktivesObjektId = nil
        aktiveAbrechnungId = nil
        richteAuswahlAus()
        aktualisiere()
        sichereSofort()
    }

    func setzeZurueck() {
        daten = Datenbestand()
        aktivesObjektId = nil
        aktiveAbrechnungId = nil
        aktualisiere()
        sichereSofort()
    }
}
