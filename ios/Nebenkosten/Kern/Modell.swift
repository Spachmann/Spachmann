import Foundation

/// Datenmodell.
///
/// Aufbau:
///   Vermieter  →  Objekte  →  Einheiten  →  Mietverhältnisse
///                     ↳  Abrechnungszeiträume (Kosten, Verbräuche, Heizung)
///
/// Ein Vermieter kann mehrere Objekte halten – etwa zwei privat vermietete
/// Immobilien und daneben eine GbR mit weiteren Objekten. Abgerechnet wird
/// immer je Objekt; die Rechenkerne arbeiten auf dem Ausschnitt, den
/// `Datenbestand.bestand(fuerObjekt:)` liefert.
///
/// Die Feldnamen entsprechen dem Sicherungsformat der Web-App, sodass
/// Sicherungen zwischen beiden Fassungen ausgetauscht werden können. Alle
/// Strukturen lesen fehlende Felder als Standardwert; Sicherungen der
/// Fassung 1 mit genau einem Vermieter und Objekt werden beim Laden
/// umgewandelt.
enum Modell {
    static let version = 2

    static func neueKennung(_ praefix: String) -> String {
        "\(praefix)_\(UUID().uuidString.prefix(12).lowercased())"
    }
}

// Erlaubt das Lesen fehlender oder unlesbarer Felder mit Standardwert.
private extension KeyedDecodingContainer {
    func wert<T: Decodable>(_ schluessel: Key, _ standard: T) -> T {
        ((try? decodeIfPresent(T.self, forKey: schluessel)) ?? nil) ?? standard
    }
}

// MARK: - Aufzählungen

/// Rechtsform des Vermieters. Gesellschaften handeln nur durch ihre Vertreter;
/// das muss die Abrechnung erkennen lassen.
enum Rechtsform: String, Codable, CaseIterable, Identifiable {
    case privat
    case ehepaar
    case gbr
    case weg
    case gmbh
    case sonstige

    var id: String { rawValue }

    var bezeichnung: String {
        switch self {
        case .privat: return "Privatperson"
        case .ehepaar: return "Eheleute / Gemeinschaft"
        case .gbr: return "GbR"
        case .weg: return "Wohnungseigentümergemeinschaft"
        case .gmbh: return "GmbH / UG"
        case .sonstige: return "Sonstige"
        }
    }

    var vertretungNoetig: Bool {
        switch self {
        case .privat, .ehepaar: return false
        case .gbr, .weg, .gmbh, .sonstige: return true
        }
    }
}

enum Vorauszahlungsmodus: String, Codable, CaseIterable, Identifiable {
    case monatlich
    case gesamt

    var id: String { rawValue }
    var bezeichnung: String {
        switch self {
        case .monatlich: return "monatlicher Betrag"
        case .gesamt: return "Gesamtbetrag im Zeitraum"
        }
    }
}

enum Verbrauchsdifferenz: String, Codable, CaseIterable, Identifiable {
    case verbrauch
    case flaeche
    case vermieter

    var id: String { rawValue }
    var bezeichnung: String {
        switch self {
        case .verbrauch: return "anteilig auf alle Verbraucher umlegen"
        case .flaeche: return "nach Wohnfläche umlegen"
        case .vermieter: return "trägt der Vermieter"
        }
    }
    var kurz: String {
        switch self {
        case .verbrauch: return "anteilig auf alle Verbraucher"
        case .flaeche: return "nach Wohnfläche"
        case .vermieter: return "trägt der Vermieter"
        }
    }
}

enum Verbrauchsart: String, Codable, CaseIterable, Identifiable {
    case kaltwasser
    case warmwasser
    case heizung

    var id: String { rawValue }
    var bezeichnung: String {
        switch self {
        case .kaltwasser: return "Kaltwasser"
        case .warmwasser: return "Warmwasser"
        case .heizung: return "Heizung"
        }
    }
    var einheit: String {
        switch self {
        case .kaltwasser, .warmwasser: return "m³"
        case .heizung: return "E"
        }
    }
    var spaltentitel: String { "\(bezeichnung) (\(einheit))" }
}

// MARK: - Vermieter

struct Vermieter: Codable, Hashable, Identifiable {
    var id = Modell.neueKennung("v")
    var name = ""
    var rechtsform: Rechtsform = .privat
    var vertretenDurch = ""
    var strasse = ""
    var plz = ""
    var ort = ""
    var telefon = ""
    var email = ""
    var iban = ""
    var bank = ""
    var steuernummer = ""

    init(name: String = "") {
        self.name = name
    }

    enum CodingKeys: String, CodingKey {
        case id, name, rechtsform, vertretenDurch, strasse, plz, ort, telefon, email, iban, bank, steuernummer
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.wert(.id, Modell.neueKennung("v"))
        name = c.wert(.name, "")
        rechtsform = c.wert(.rechtsform, .privat)
        vertretenDurch = c.wert(.vertretenDurch, "")
        strasse = c.wert(.strasse, "")
        plz = c.wert(.plz, "")
        ort = c.wert(.ort, "")
        telefon = c.wert(.telefon, "")
        email = c.wert(.email, "")
        iban = c.wert(.iban, "")
        bank = c.wert(.bank, "")
        steuernummer = c.wert(.steuernummer, "")
    }

    /// Name, bei Gesellschaften ergänzt um die vertretungsberechtigten Personen.
    var anzeigename: String {
        vertretenDurch.isEmpty ? name : "\(name), vertreten durch \(vertretenDurch)"
    }

    var anschriftszeile: String {
        [anzeigename, strasse, [plz, ort].filter { !$0.isEmpty }.joined(separator: " ")]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }
}

// MARK: - Objekt

struct Objekt: Codable, Hashable, Identifiable {
    var id = Modell.neueKennung("o")
    var vermieterId = ""
    var bezeichnung = ""
    var strasse = ""
    var plz = ""
    var ort = ""
    var wohnflaecheGesamt: Double = 0
    var gebaeudetyp: Gebaeudetyp = .wohn
    var leerstandPersonen: Double = 1
    var verbrauchsdifferenz: Verbrauchsdifferenz = .verbrauch
    var notiz = ""

    init(vermieterId: String = "", bezeichnung: String = "") {
        self.vermieterId = vermieterId
        self.bezeichnung = bezeichnung
    }

    enum CodingKeys: String, CodingKey {
        case id, vermieterId, bezeichnung, strasse, plz, ort, wohnflaecheGesamt
        case gebaeudetyp, leerstandPersonen, verbrauchsdifferenz, notiz
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.wert(.id, Modell.neueKennung("o"))
        vermieterId = c.wert(.vermieterId, "")
        bezeichnung = c.wert(.bezeichnung, "")
        strasse = c.wert(.strasse, "")
        plz = c.wert(.plz, "")
        ort = c.wert(.ort, "")
        wohnflaecheGesamt = c.wert(.wohnflaecheGesamt, 0)
        gebaeudetyp = c.wert(.gebaeudetyp, .wohn)
        leerstandPersonen = c.wert(.leerstandPersonen, 1)
        verbrauchsdifferenz = c.wert(.verbrauchsdifferenz, .verbrauch)
        notiz = c.wert(.notiz, "")
    }

    var anschrift: String {
        [strasse, [plz, ort].filter { !$0.isEmpty }.joined(separator: " ")]
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    var anzeigename: String {
        if !bezeichnung.isEmpty { return bezeichnung }
        if !strasse.isEmpty { return strasse }
        return "Objekt"
    }
}

// MARK: - Einheit und Mietverhältnis

struct Einheit: Codable, Hashable, Identifiable {
    var id = Modell.neueKennung("e")
    var objektId = ""
    var bezeichnung = ""
    var lage = ""
    var wohnflaeche: Double = 0
    var mea: Double = 0
    var notiz = ""

    init(objektId: String = "", bezeichnung: String = "") {
        self.objektId = objektId
        self.bezeichnung = bezeichnung
    }

    enum CodingKeys: String, CodingKey {
        case id, objektId, bezeichnung, lage, wohnflaeche, mea, notiz
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.wert(.id, Modell.neueKennung("e"))
        objektId = c.wert(.objektId, "")
        bezeichnung = c.wert(.bezeichnung, "")
        lage = c.wert(.lage, "")
        wohnflaeche = c.wert(.wohnflaeche, 0)
        mea = c.wert(.mea, 0)
        notiz = c.wert(.notiz, "")
    }
}

struct Mietverhaeltnis: Codable, Hashable, Identifiable {
    var id = Modell.neueKennung("m")
    var einheitId = ""
    var mieterName = ""
    var mieterAnschrift = ""
    var von = ""
    var bis = ""
    var personen: Double = 1
    var vzModus: Vorauszahlungsmodus = .monatlich
    var vzBetriebskostenMonat: Cent = 0
    var vzHeizkostenMonat: Cent = 0
    var vzGesamtBetriebskosten: Cent = 0
    var vzGesamtHeizkosten: Cent = 0

    init(einheitId: String = "", jahr: Int = 2024) {
        self.einheitId = einheitId
        self.von = String(format: "%04d-01-01", jahr)
    }

    enum CodingKeys: String, CodingKey {
        case id, einheitId, mieterName, mieterAnschrift, von, bis, personen, vzModus
        case vzBetriebskostenMonat, vzHeizkostenMonat, vzGesamtBetriebskosten, vzGesamtHeizkosten
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.wert(.id, Modell.neueKennung("m"))
        einheitId = c.wert(.einheitId, "")
        mieterName = c.wert(.mieterName, "")
        mieterAnschrift = c.wert(.mieterAnschrift, "")
        von = c.wert(.von, "")
        bis = c.wert(.bis, "")
        personen = c.wert(.personen, 1)
        vzModus = c.wert(.vzModus, .monatlich)
        vzBetriebskostenMonat = c.wert(.vzBetriebskostenMonat, 0)
        vzHeizkostenMonat = c.wert(.vzHeizkostenMonat, 0)
        vzGesamtBetriebskosten = c.wert(.vzGesamtBetriebskosten, 0)
        vzGesamtHeizkosten = c.wert(.vzGesamtHeizkosten, 0)
    }

    /// Ende des Mietverhältnisses; ist kein Ende erfasst, gilt das Zeitraumende.
    func ende(spaetestens grenze: String) -> String { bis.isEmpty ? grenze : bis }
}

// MARK: - Kostenposition

struct Position: Codable, Hashable, Identifiable {
    var id = Modell.neueKennung("p")
    var kostenartId = "grundsteuer"
    var bezeichnung = ""
    var betragBrutto: Cent = 0
    var abzugBetrag: Cent = 0
    var abzugGrund = ""
    var schluessel: Schluessel = .flaeche
    var direktEinheitId = ""
    var verbrauchsart: Verbrauchsart = .kaltwasser
    var umlagefaehig = true
    var zeitraumVon = ""
    var zeitraumBis = ""
    var lohnanteilHaushaltsnah: Cent = 0
    var lohnanteilHandwerker: Cent = 0
    var lieferant = ""
    var beleg = ""
    var notiz = ""
    var imMietvertragVereinbart = false

    init(kostenartId: String = "grundsteuer", schluessel: Schluessel = .flaeche, betragBrutto: Cent = 0) {
        self.kostenartId = kostenartId
        self.schluessel = schluessel
        self.betragBrutto = betragBrutto
    }

    enum CodingKeys: String, CodingKey {
        case id, kostenartId, bezeichnung, betragBrutto, abzugBetrag, abzugGrund, schluessel
        case direktEinheitId, verbrauchsart, umlagefaehig, zeitraumVon, zeitraumBis
        case lohnanteilHaushaltsnah, lohnanteilHandwerker, lieferant, beleg, notiz, imMietvertragVereinbart
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.wert(.id, Modell.neueKennung("p"))
        kostenartId = c.wert(.kostenartId, "grundsteuer")
        bezeichnung = c.wert(.bezeichnung, "")
        betragBrutto = c.wert(.betragBrutto, 0)
        abzugBetrag = c.wert(.abzugBetrag, 0)
        abzugGrund = c.wert(.abzugGrund, "")
        schluessel = c.wert(.schluessel, .flaeche)
        direktEinheitId = c.wert(.direktEinheitId, "")
        verbrauchsart = c.wert(.verbrauchsart, .kaltwasser)
        umlagefaehig = c.wert(.umlagefaehig, true)
        zeitraumVon = c.wert(.zeitraumVon, "")
        zeitraumBis = c.wert(.zeitraumBis, "")
        lohnanteilHaushaltsnah = c.wert(.lohnanteilHaushaltsnah, 0)
        lohnanteilHandwerker = c.wert(.lohnanteilHandwerker, 0)
        lieferant = c.wert(.lieferant, "")
        beleg = c.wert(.beleg, "")
        notiz = c.wert(.notiz, "")
        imMietvertragVereinbart = c.wert(.imMietvertragVereinbart, false)
    }

    var art: Kostenartinfo? { Katalog.art(kostenartId) }

    var anzeigename: String {
        bezeichnung.isEmpty ? (art?.bezeichnung ?? kostenartId) : bezeichnung
    }

    /// Nach Abzug des nicht umlagefähigen Anteils verbleibender Betrag.
    var umlagebetrag: Cent { max(0, betragBrutto - abzugBetrag) }

    /// Eine Position ist umlagefähig, wenn sie einer Kostenart des § 2 BetrKV
    /// zugeordnet, nicht manuell ausgeschlossen und keine Heizkostenposition ist.
    var istUmlagefaehig: Bool {
        umlagefaehig
            && Katalog.istUmlagefaehigeArt(kostenartId)
            && !Katalog.heizarten.contains(kostenartId)
    }
}

// MARK: - Verbrauch

struct Verbrauch: Codable, Hashable, Identifiable {
    var id = Modell.neueKennung("v")
    var einheitId = ""
    var mietverhaeltnisId: String?
    var art: Verbrauchsart = .kaltwasser
    var wert: Double = 0

    init(einheitId: String, mietverhaeltnisId: String?, art: Verbrauchsart, wert: Double) {
        self.einheitId = einheitId
        self.mietverhaeltnisId = mietverhaeltnisId
        self.art = art
        self.wert = wert
    }

    enum CodingKeys: String, CodingKey {
        case id, einheitId, mietverhaeltnisId, art, wert
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.wert(.id, Modell.neueKennung("v"))
        einheitId = c.wert(.einheitId, "")
        mietverhaeltnisId = (try? c.decodeIfPresent(String.self, forKey: .mietverhaeltnisId)) ?? nil
        art = c.wert(.art, .kaltwasser)
        wert = c.wert(.wert, 0)
    }
}

// MARK: - Heizung

struct Heizkostenpositionen: Codable, Hashable {
    var brennstoff: Cent = 0
    var betriebsstrom: Cent = 0
    var wartung: Cent = 0
    var messdienst: Cent = 0
    var schornsteinfeger: Cent = 0
    var sonstiges: Cent = 0

    init() {}

    var nebenkosten: Cent { betriebsstrom + wartung + messdienst + schornsteinfeger + sonstiges }
    var gesamt: Cent { brennstoff + nebenkosten }

    enum CodingKeys: String, CodingKey {
        case brennstoff, betriebsstrom, wartung, messdienst, schornsteinfeger, sonstiges
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        brennstoff = c.wert(.brennstoff, 0)
        betriebsstrom = c.wert(.betriebsstrom, 0)
        wartung = c.wert(.wartung, 0)
        messdienst = c.wert(.messdienst, 0)
        schornsteinfeger = c.wert(.schornsteinfeger, 0)
        sonstiges = c.wert(.sonstiges, 0)
    }
}

struct Warmwassereinstellung: Codable, Hashable {
    var modus: Warmwassermethode = .formel
    var volumen: Double = 0
    var temperatur: Double = 60
    var warmwasserKwh: Double = 0
    var prozentsatz: Double = 0.18

    init() {}

    enum CodingKeys: String, CodingKey {
        case modus, volumen, temperatur, warmwasserKwh, prozentsatz
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        modus = c.wert(.modus, .formel)
        volumen = c.wert(.volumen, 0)
        temperatur = c.wert(.temperatur, 60)
        warmwasserKwh = c.wert(.warmwasserKwh, 0)
        prozentsatz = c.wert(.prozentsatz, 0.18)
    }
}

struct CO2Einstellung: Codable, Hashable {
    var kostenCent: Cent = 0
    var emissionKg: Double = 0
    var gebaeudetyp: Gebaeudetyp = .wohn
    var ausnahme = false

    init() {}

    enum CodingKeys: String, CodingKey {
        case kostenCent, emissionKg, gebaeudetyp, ausnahme
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kostenCent = c.wert(.kostenCent, 0)
        emissionKg = c.wert(.emissionKg, 0)
        gebaeudetyp = c.wert(.gebaeudetyp, .wohn)
        ausnahme = c.wert(.ausnahme, false)
    }
}

struct Heizungseinstellungen: Codable, Hashable {
    var aktiv = false
    var verbunden = true
    var brennstoff: Brennstoff = .erdgas
    var brennstoffmenge: Double = 0
    var gesamtwaermeKwh: Double = 0
    var kosten = Heizkostenpositionen()
    var kostenWarmwasserSeparat: Cent = 0
    var warmwasser = Warmwassereinstellung()
    var anteilVerbrauchHeizung: Double = 0.7
    var anteilVerbrauchWarmwasser: Double = 0.7
    var verbrauchserfassung = true
    var co2 = CO2Einstellung()

    init() {}

    enum CodingKeys: String, CodingKey {
        case aktiv, verbunden, brennstoff, brennstoffmenge, gesamtwaermeKwh, kosten
        case kostenWarmwasserSeparat, warmwasser, anteilVerbrauchHeizung, anteilVerbrauchWarmwasser
        case verbrauchserfassung, co2
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        aktiv = c.wert(.aktiv, false)
        verbunden = c.wert(.verbunden, true)
        brennstoff = c.wert(.brennstoff, .erdgas)
        brennstoffmenge = c.wert(.brennstoffmenge, 0)
        gesamtwaermeKwh = c.wert(.gesamtwaermeKwh, 0)
        kosten = c.wert(.kosten, Heizkostenpositionen())
        kostenWarmwasserSeparat = c.wert(.kostenWarmwasserSeparat, 0)
        warmwasser = c.wert(.warmwasser, Warmwassereinstellung())
        anteilVerbrauchHeizung = c.wert(.anteilVerbrauchHeizung, 0.7)
        anteilVerbrauchWarmwasser = c.wert(.anteilVerbrauchWarmwasser, 0.7)
        verbrauchserfassung = c.wert(.verbrauchserfassung, true)
        co2 = c.wert(.co2, CO2Einstellung())
    }
}

struct Hauptzaehler: Codable, Hashable {
    var kaltwasser: Double = 0
    var warmwasser: Double = 0
    var heizung: Double = 0

    init() {}

    enum CodingKeys: String, CodingKey { case kaltwasser, warmwasser, heizung }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kaltwasser = c.wert(.kaltwasser, 0)
        warmwasser = c.wert(.warmwasser, 0)
        heizung = c.wert(.heizung, 0)
    }

    func wert(_ art: Verbrauchsart) -> Double {
        switch art {
        case .kaltwasser: return kaltwasser
        case .warmwasser: return warmwasser
        case .heizung: return heizung
        }
    }
}

// MARK: - Abrechnungszeitraum

struct Abrechnungszeitraum: Codable, Hashable, Identifiable {
    var id = Modell.neueKennung("a")
    var objektId = ""
    var jahr = 2024
    var von = "2024-01-01"
    var bis = "2024-12-31"
    var erstelltAm = ""
    var zugestelltAm = ""
    var zahlungsfristTage = 30
    var positionen: [Position] = []
    var verbraeuche: [Verbrauch] = []
    var hauptzaehler = Hauptzaehler()
    var heizung = Heizungseinstellungen()

    init(objektId: String, jahr: Int) {
        self.objektId = objektId
        self.jahr = jahr
        self.von = String(format: "%04d-01-01", jahr)
        self.bis = String(format: "%04d-12-31", jahr)
    }

    enum CodingKeys: String, CodingKey {
        case id, objektId, jahr, von, bis, erstelltAm, zugestelltAm, zahlungsfristTage
        case positionen, verbraeuche, hauptzaehler, heizung
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let standardJahr = c.wert(.jahr, 2024)
        id = c.wert(.id, Modell.neueKennung("a"))
        objektId = c.wert(.objektId, "")
        jahr = standardJahr
        von = c.wert(.von, String(format: "%04d-01-01", standardJahr))
        bis = c.wert(.bis, String(format: "%04d-12-31", standardJahr))
        erstelltAm = c.wert(.erstelltAm, "")
        zugestelltAm = c.wert(.zugestelltAm, "")
        zahlungsfristTage = c.wert(.zahlungsfristTage, 30)
        positionen = c.wert(.positionen, [])
        verbraeuche = c.wert(.verbraeuche, [])
        hauptzaehler = c.wert(.hauptzaehler, Hauptzaehler())
        heizung = c.wert(.heizung, Heizungseinstellungen())
    }

    var tage: Int { Datum.tage(von, bis) }

    /// Ende der Abrechnungsfrist des § 556 Abs. 3 Satz 2 BGB.
    var abrechnungsfrist: String { Datum.plusMonate(bis, 12) }

    func verbrauch(einheitId: String, mietverhaeltnisId: String?, art: Verbrauchsart) -> Verbrauch? {
        verbraeuche.first {
            $0.einheitId == einheitId && $0.mietverhaeltnisId == mietverhaeltnisId && $0.art == art
        }
    }

    mutating func setzeVerbrauch(einheitId: String, mietverhaeltnisId: String?, art: Verbrauchsart, wert: Double) {
        if let index = verbraeuche.firstIndex(where: {
            $0.einheitId == einheitId && $0.mietverhaeltnisId == mietverhaeltnisId && $0.art == art
        }) {
            verbraeuche[index].wert = wert
        } else {
            verbraeuche.append(Verbrauch(einheitId: einheitId, mietverhaeltnisId: mietverhaeltnisId, art: art, wert: wert))
        }
    }
}

// MARK: - Ausschnitt für ein Objekt

/// Der auf ein Objekt zugeschnittene Bestand.
///
/// Abrechnung, Prüfung und Dokumenterzeugung arbeiten ausschließlich hierauf
/// und bleiben dadurch frei von Mehrobjektlogik.
struct Objektbestand {
    var vermieter: Vermieter
    var objekt: Objekt
    var einheiten: [Einheit]
    var mietverhaeltnisse: [Mietverhaeltnis]

    func einheit(_ id: String) -> Einheit? { einheiten.first { $0.id == id } }

    func mietverhaeltnisseZu(einheitId: String) -> [Mietverhaeltnis] {
        mietverhaeltnisse.filter { $0.einheitId == einheitId }
    }

    var summeWohnflaechen: Double { einheiten.map(\.wohnflaeche).summe }

    /// Gesamtwohnfläche des Objekts; ist keine erfasst, gilt die Summe der Einheiten.
    var massgeblicheWohnflaeche: Double {
        objekt.wohnflaecheGesamt > 0 ? objekt.wohnflaecheGesamt : summeWohnflaechen
    }
}

// MARK: - Gesamtbestand

struct Datenbestand: Codable, Hashable {
    var version = Modell.version
    var vermieter: [Vermieter] = []
    var objekte: [Objekt] = []
    var einheiten: [Einheit] = []
    var mietverhaeltnisse: [Mietverhaeltnis] = []
    var abrechnungen: [Abrechnungszeitraum] = []

    init() {}

    enum CodingKeys: String, CodingKey {
        case version, vermieter, objekte, objekt, einheiten, mietverhaeltnisse, abrechnungen
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = c.wert(.version, Modell.version)
        einheiten = c.wert(.einheiten, [])
        mietverhaeltnisse = c.wert(.mietverhaeltnisse, [])
        abrechnungen = c.wert(.abrechnungen, [])

        // Fassung 2 führt Vermieter und Objekte als Listen …
        if let liste = ((try? c.decodeIfPresent([Vermieter].self, forKey: .vermieter)) ?? nil) {
            vermieter = liste
            objekte = c.wert(.objekte, [])
        } else if let einzeln = ((try? c.decodeIfPresent(Vermieter.self, forKey: .vermieter)) ?? nil) {
            // … Fassung 1 kannte je genau einen Eintrag.
            vermieter = [einzeln]
            var objekt = ((try? c.decodeIfPresent(Objekt.self, forKey: .objekt)) ?? nil) ?? Objekt()
            objekt.vermieterId = einzeln.id
            objekte = [objekt]
        } else {
            vermieter = []
            objekte = c.wert(.objekte, [])
        }

        ordneZu()
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(version, forKey: .version)
        try c.encode(vermieter, forKey: .vermieter)
        try c.encode(objekte, forKey: .objekte)
        try c.encode(einheiten, forKey: .einheiten)
        try c.encode(mietverhaeltnisse, forKey: .mietverhaeltnisse)
        try c.encode(abrechnungen, forKey: .abrechnungen)
    }

    /// Hängt Objekte, Einheiten und Abrechnungen an gültige Elternobjekte.
    /// Damit bleiben auch unvollständige oder ältere Sicherungen benutzbar.
    private mutating func ordneZu() {
        version = Modell.version
        guard let erstesObjekt = objekte.first?.id else { return }
        let vermieterIds = Set(vermieter.map(\.id))
        let objektIds = Set(objekte.map(\.id))

        if let ersterVermieter = vermieter.first?.id {
            for index in objekte.indices where !vermieterIds.contains(objekte[index].vermieterId) {
                objekte[index].vermieterId = ersterVermieter
            }
        }
        for index in einheiten.indices where !objektIds.contains(einheiten[index].objektId) {
            einheiten[index].objektId = erstesObjekt
        }
        for index in abrechnungen.indices where !objektIds.contains(abrechnungen[index].objektId) {
            abrechnungen[index].objektId = erstesObjekt
        }
    }

    // MARK: Zugriff

    func vermieterMit(id: String) -> Vermieter? { vermieter.first { $0.id == id } }
    func objektMit(id: String) -> Objekt? { objekte.first { $0.id == id } }

    func einheitenZu(objektId: String) -> [Einheit] {
        einheiten.filter { $0.objektId == objektId }
    }

    func mietverhaeltnisseZu(objektId: String) -> [Mietverhaeltnis] {
        let ids = Set(einheitenZu(objektId: objektId).map(\.id))
        return mietverhaeltnisse.filter { ids.contains($0.einheitId) }
    }

    /// Abrechnungszeiträume eines Objekts, neueste zuerst.
    func abrechnungenZu(objektId: String) -> [Abrechnungszeitraum] {
        abrechnungen.filter { $0.objektId == objektId }.sorted { $0.jahr > $1.jahr }
    }

    func objekteZu(vermieterId: String) -> [Objekt] {
        objekte.filter { $0.vermieterId == vermieterId }
    }

    /// Schneidet den Bestand auf ein Objekt zu.
    func bestand(fuerObjekt objektId: String) -> Objektbestand? {
        guard let objekt = objektMit(id: objektId) else { return nil }
        return Objektbestand(
            vermieter: vermieterMit(id: objekt.vermieterId) ?? Vermieter(),
            objekt: objekt,
            einheiten: einheitenZu(objektId: objektId),
            mietverhaeltnisse: mietverhaeltnisseZu(objektId: objektId))
    }
}
