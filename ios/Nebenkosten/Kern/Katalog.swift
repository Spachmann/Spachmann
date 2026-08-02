import Foundation

/// Verteilerschlüssel. Die Rohwerte entsprechen dem Sicherungsformat der Web-App.
enum Schluessel: String, Codable, CaseIterable, Identifiable, Hashable {
    case flaeche
    case personen
    case einheiten
    case mea
    case verbrauchWasser = "verbrauch_wasser"
    case direkt
    case heizung

    var id: String { rawValue }

    var info: Schluesselinfo { Katalog.info(self) }

    /// Schlüssel, die der Nutzer einer Position zuordnen kann.
    /// Heizkosten laufen ausschließlich über die Heizkostenverordnung.
    static var waehlbare: [Schluessel] { allCases.filter { $0 != .heizung } }
}

struct Schluesselinfo {
    let kurz: String
    let bezeichnung: String
    let einheit: String
    let rechtsgrundlage: String
    let zeitanteilig: Bool
}

/// Beschreibt eine Kostenart – entweder aus dem Katalog des § 2 BetrKV
/// (dann ist `nr` gesetzt) oder eine typischerweise nicht umlagefähige Art
/// (dann ist `grund` gesetzt).
struct Kostenartinfo: Identifiable, Hashable {
    let id: String
    let nr: Int?
    let bezeichnung: String
    let rechtsgrundlage: String
    let schluessel: Schluessel
    let beispiele: [String]
    let warnung: String?
    let hinweis: String?
    let grund: String?
    let vertragBenennungNoetig: Bool

    var istUmlagefaehigeArt: Bool { nr != nil }

    /// Bezeichnung mit vorangestellter Nummer des § 2 BetrKV.
    var nummerierteBezeichnung: String {
        guard let nr else { return bezeichnung }
        return "\(nr). \(bezeichnung)"
    }

    static func == (links: Kostenartinfo, rechts: Kostenartinfo) -> Bool { links.id == rechts.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    init(
        _ id: String,
        nr: Int? = nil,
        bezeichnung: String,
        rechtsgrundlage: String,
        schluessel: Schluessel = .flaeche,
        beispiele: [String] = [],
        warnung: String? = nil,
        hinweis: String? = nil,
        grund: String? = nil,
        vertragBenennungNoetig: Bool = false
    ) {
        self.id = id
        self.nr = nr
        self.bezeichnung = bezeichnung
        self.rechtsgrundlage = rechtsgrundlage
        self.schluessel = schluessel
        self.beispiele = beispiele
        self.warnung = warnung
        self.hinweis = hinweis
        self.grund = grund
        self.vertragBenennungNoetig = vertragBenennungNoetig
    }
}

/// Kostenarten-Katalog.
///
/// Umlagefähig ist ausschließlich, was im abschließenden Katalog des
/// § 2 BetrKV steht. Nicht umlagefähig sind insbesondere Verwaltungskosten
/// sowie Instandhaltung und Instandsetzung (§ 1 Abs. 2 BetrKV).
enum Katalog {

    // MARK: - Verteilerschlüssel

    static func info(_ schluessel: Schluessel) -> Schluesselinfo {
        switch schluessel {
        case .flaeche:
            return Schluesselinfo(
                kurz: "Wohnfläche",
                bezeichnung: "Anteil der Wohnfläche an der Gesamtwohnfläche",
                einheit: "m²",
                rechtsgrundlage: "§ 556a Abs. 1 Satz 1 BGB (gesetzlicher Auffangschlüssel)",
                zeitanteilig: true)
        case .personen:
            return Schluesselinfo(
                kurz: "Personenzahl",
                bezeichnung: "Anteil der im Zeitraum wohnenden Personen (Personentage)",
                einheit: "Pers.",
                rechtsgrundlage: "vertraglich vereinbarter Umlagemaßstab, § 556a Abs. 1 BGB",
                zeitanteilig: true)
        case .einheiten:
            return Schluesselinfo(
                kurz: "Wohneinheiten",
                bezeichnung: "gleichmäßig nach Anzahl der Wohneinheiten",
                einheit: "Einheit",
                rechtsgrundlage: "vertraglich vereinbarter Umlagemaßstab, § 556a Abs. 1 BGB",
                zeitanteilig: true)
        case .mea:
            return Schluesselinfo(
                kurz: "Miteigentumsanteile",
                bezeichnung: "Anteil nach Miteigentumsanteilen (MEA)",
                einheit: "MEA",
                rechtsgrundlage: "vertraglich vereinbarter Umlagemaßstab, § 556a Abs. 1 BGB",
                zeitanteilig: true)
        case .verbrauchWasser:
            return Schluesselinfo(
                kurz: "Verbrauch",
                bezeichnung: "erfasster Wasserverbrauch laut Zwischenzähler",
                einheit: "m³",
                rechtsgrundlage: "§ 556a Abs. 1 Satz 2 BGB (Erfassungspflicht bei Verbrauchserfassung)",
                zeitanteilig: false)
        case .direkt:
            return Schluesselinfo(
                kurz: "Direktzuordnung",
                bezeichnung: "Kosten werden einer Einheit unmittelbar zugeordnet",
                einheit: "",
                rechtsgrundlage: "verursachungsgerechte Zuordnung",
                zeitanteilig: true)
        case .heizung:
            return Schluesselinfo(
                kurz: "Heizkostenverordnung",
                bezeichnung: "Abrechnung nach HeizkostenV (Grund- und Verbrauchsanteil)",
                einheit: "",
                rechtsgrundlage: "§§ 6–9 HeizkostenV",
                zeitanteilig: false)
        }
    }

    // MARK: - § 2 BetrKV

    static let betriebskosten: [Kostenartinfo] = [
        Kostenartinfo("grundsteuer", nr: 1,
            bezeichnung: "Laufende öffentliche Lasten des Grundstücks (Grundsteuer)",
            rechtsgrundlage: "§ 2 Nr. 1 BetrKV",
            schluessel: .flaeche,
            beispiele: ["Grundsteuer B", "Deichabgaben"]),

        Kostenartinfo("wasser", nr: 2,
            bezeichnung: "Kosten der Wasserversorgung",
            rechtsgrundlage: "§ 2 Nr. 2 BetrKV",
            schluessel: .verbrauchWasser,
            beispiele: ["Frischwasser", "Grundgebühr Wasser", "Zählermiete", "Eichung", "Wasseraufbereitung"],
            warnung: "Sind Wasserzähler vorhanden, ist verbrauchsabhängig abzurechnen (§ 556a Abs. 1 Satz 2 BGB)."),

        Kostenartinfo("entwaesserung", nr: 3,
            bezeichnung: "Kosten der Entwässerung",
            rechtsgrundlage: "§ 2 Nr. 3 BetrKV",
            schluessel: .verbrauchWasser,
            beispiele: ["Schmutzwassergebühr", "Niederschlagswassergebühr", "Entleerung Kleinkläranlage"]),

        Kostenartinfo("heizung", nr: 4,
            bezeichnung: "Kosten des Betriebs der zentralen Heizungsanlage",
            rechtsgrundlage: "§ 2 Nr. 4 lit. a–c BetrKV, HeizkostenV",
            schluessel: .heizung,
            beispiele: ["Brennstoff", "Betriebsstrom", "Wartung", "Abgasmessung", "Messdienst", "Fernwärme"],
            hinweis: "Wird über den Bereich „Heizung & Warmwasser“ nach HeizkostenV abgerechnet."),

        Kostenartinfo("warmwasser", nr: 5,
            bezeichnung: "Kosten der Warmwasserversorgung",
            rechtsgrundlage: "§ 2 Nr. 5 BetrKV, HeizkostenV",
            schluessel: .heizung,
            beispiele: ["Brennstoff Warmwasser", "Betriebsstrom", "Wartung", "Legionellenprüfung"],
            hinweis: "Wird über den Bereich „Heizung & Warmwasser“ nach HeizkostenV abgerechnet."),

        Kostenartinfo("verbundene_anlage", nr: 6,
            bezeichnung: "Kosten verbundener Heizungs- und Warmwasserversorgungsanlagen",
            rechtsgrundlage: "§ 2 Nr. 6 BetrKV, § 9 HeizkostenV",
            schluessel: .heizung,
            beispiele: ["gemeinsame Erzeugung von Heizwärme und Warmwasser"],
            hinweis: "Aufteilung nach § 9 HeizkostenV im Bereich „Heizung & Warmwasser“."),

        Kostenartinfo("aufzug", nr: 7,
            bezeichnung: "Kosten des Betriebs des Personen- oder Lastenaufzugs",
            rechtsgrundlage: "§ 2 Nr. 7 BetrKV",
            schluessel: .flaeche,
            beispiele: ["Betriebsstrom", "Wartung", "Notrufbereitschaft", "TÜV-Prüfung", "Reinigung"],
            warnung: "Reparaturen an der Aufzugsanlage sind Instandsetzung und nicht umlagefähig."),

        Kostenartinfo("strassenreinigung_muell", nr: 8,
            bezeichnung: "Kosten der Straßenreinigung und Müllbeseitigung",
            rechtsgrundlage: "§ 2 Nr. 8 BetrKV",
            schluessel: .personen,
            beispiele: ["Straßenreinigungsgebühr", "Winterdienst", "Restmüll", "Bio-/Papiertonne", "Sperrmüll", "Müllschleuse"]),

        Kostenartinfo("gebaeudereinigung", nr: 9,
            bezeichnung: "Kosten der Gebäudereinigung und Ungezieferbekämpfung",
            rechtsgrundlage: "§ 2 Nr. 9 BetrKV",
            schluessel: .flaeche,
            beispiele: ["Treppenhausreinigung", "Reinigung Tiefgarage", "Glasreinigung", "Schädlingsbekämpfung"],
            warnung: "Ungezieferbekämpfung nur als laufende Vorsorge; die einmalige Beseitigung eines Befalls ist Instandsetzung."),

        Kostenartinfo("gartenpflege", nr: 10,
            bezeichnung: "Kosten der Gartenpflege",
            rechtsgrundlage: "§ 2 Nr. 10 BetrKV",
            schluessel: .flaeche,
            beispiele: ["Rasenmähen", "Baum- und Heckenschnitt", "Pflanzen ersetzen", "Spielplatzpflege"],
            warnung: "Die Neuanlage eines Gartens ist nicht umlagefähig, nur die laufende Pflege und das Ersetzen abgängiger Pflanzen."),

        Kostenartinfo("beleuchtung", nr: 11,
            bezeichnung: "Kosten der Beleuchtung",
            rechtsgrundlage: "§ 2 Nr. 11 BetrKV",
            schluessel: .flaeche,
            beispiele: ["Allgemeinstrom Treppenhaus", "Außenbeleuchtung", "Keller", "Tiefgarage"],
            warnung: "Nur Stromkosten; eine Neuinstallation ist nicht umlagefähig."),

        Kostenartinfo("schornsteinreinigung", nr: 12,
            bezeichnung: "Kosten der Schornsteinreinigung",
            rechtsgrundlage: "§ 2 Nr. 12 BetrKV",
            schluessel: .flaeche,
            beispiele: ["Kehrgebühren", "Feuerstättenschau"],
            warnung: "Soweit bereits in den Heizkosten nach Nr. 4 enthalten, hier nicht nochmals ansetzen."),

        Kostenartinfo("versicherung", nr: 13,
            bezeichnung: "Kosten der Sach- und Haftpflichtversicherung",
            rechtsgrundlage: "§ 2 Nr. 13 BetrKV",
            schluessel: .flaeche,
            beispiele: ["Wohngebäudeversicherung", "Haus- und Grundbesitzerhaftpflicht", "Elementarschaden", "Öltank", "Glasversicherung"],
            warnung: "Rechtsschutz-, Mietausfall- und Hausratversicherung des Vermieters sind nicht umlagefähig."),

        Kostenartinfo("hauswart", nr: 14,
            bezeichnung: "Kosten für den Hauswart",
            rechtsgrundlage: "§ 2 Nr. 14 BetrKV",
            schluessel: .flaeche,
            beispiele: ["Vergütung", "Sozialbeiträge", "geldwerte Leistungen"],
            warnung: "Anteile für Instandhaltung, Instandsetzung, Erneuerung, Schönheitsreparaturen und Verwaltung müssen herausgerechnet werden (§ 2 Nr. 14 Halbsatz 2 BetrKV). Erfasse sie als nicht umlagefähigen Abzug."),

        Kostenartinfo("antenne_breitband", nr: 15,
            bezeichnung: "Kosten des Betriebs der Gemeinschafts-Antennenanlage oder des Breitbandnetzes",
            rechtsgrundlage: "§ 2 Nr. 15 BetrKV",
            schluessel: .einheiten,
            beispiele: ["Betrieb Gemeinschaftsantenne", "Glasfaserbereitstellungsentgelt (§ 72 TKG)"],
            warnung: "Das TV-Nebenkostenprivileg ist zum 30.06.2024 entfallen: Entgelte für Kabel-TV-Sammelverträge sind seit dem 01.07.2024 nicht mehr umlagefähig. Umlagefähig bleiben der Betrieb einer eigenen Gemeinschaftsantenne sowie unter den Voraussetzungen des § 72 TKG das Glasfaser-Bereitstellungsentgelt."),

        Kostenartinfo("waeschepflege", nr: 16,
            bezeichnung: "Kosten des Betriebs der Einrichtungen für die Wäschepflege",
            rechtsgrundlage: "§ 2 Nr. 16 BetrKV",
            schluessel: .einheiten,
            beispiele: ["Strom", "Wartung Waschmaschine und Trockner", "Wasserkosten Waschküche"]),

        Kostenartinfo("sonstige", nr: 17,
            bezeichnung: "Sonstige Betriebskosten",
            rechtsgrundlage: "§ 2 Nr. 17 BetrKV",
            schluessel: .flaeche,
            beispiele: ["Wartung Rauchwarnmelder", "Wartung Lüftungsanlage", "Dachrinnenreinigung", "Sicherheitsdienst", "Wartung Feuerlöscher"],
            warnung: "Nur umlagefähig, wenn die konkrete Kostenart im Mietvertrag ausdrücklich benannt ist. Eine pauschale Klausel „sonstige Betriebskosten“ genügt nicht (BGH VIII ZR 137/09).",
            vertragBenennungNoetig: true),
    ]

    // MARK: - Nicht umlagefähige Kosten

    static let nichtUmlagefaehig: [Kostenartinfo] = [
        Kostenartinfo("verwaltung",
            bezeichnung: "Verwaltungskosten",
            rechtsgrundlage: "§ 1 Abs. 2 Nr. 1 BetrKV",
            beispiele: ["Hausverwaltervergütung", "Geschäftsführung", "Kontoführung", "Buchhaltung", "Steuerberater", "Erstellung der Betriebskostenabrechnung"],
            grund: "Verwaltungskosten sind ausdrücklich keine Betriebskosten."),

        Kostenartinfo("instandhaltung",
            bezeichnung: "Instandhaltung und Instandsetzung",
            rechtsgrundlage: "§ 1 Abs. 2 Nr. 2 BetrKV",
            beispiele: ["Reparaturen", "Malerarbeiten", "Dachsanierung", "Austausch defekter Bauteile", "Rohrbruchbeseitigung"],
            grund: "Erhaltungsaufwand trägt nach § 535 Abs. 1 Satz 2 BGB der Vermieter."),

        Kostenartinfo("ruecklage",
            bezeichnung: "Zuführung zur Instandhaltungsrücklage",
            rechtsgrundlage: "§ 1 Abs. 2 Nr. 2 BetrKV analog",
            beispiele: ["Erhaltungsrücklage nach WEG-Abrechnung"],
            grund: "Rücklagenzuführungen sind kein laufender Betriebsaufwand."),

        Kostenartinfo("mietausfallwagnis",
            bezeichnung: "Mietausfallwagnis und Leerstandskosten",
            rechtsgrundlage: "§ 1 Abs. 2 BetrKV, § 556 Abs. 1 BGB",
            beispiele: ["Mietausfall", "Betriebskosten leerstehender Einheiten"],
            grund: "Das Vermietungsrisiko trägt der Vermieter; Leerstandsanteile bleiben bei ihm."),

        Kostenartinfo("anschaffung",
            bezeichnung: "Anschaffungs- und Herstellungskosten",
            rechtsgrundlage: "§ 1 Abs. 1 BetrKV (keine laufenden Kosten)",
            beispiele: ["Erstanschaffung Rauchwarnmelder", "Neuanlage Garten", "Anschaffung Mülltonnen", "Baukostenzuschuss"],
            grund: "Einmalige Investitionen sind keine laufend entstehenden Betriebskosten."),

        Kostenartinfo("rechtskosten",
            bezeichnung: "Rechts- und Bankkosten",
            rechtsgrundlage: "§ 1 Abs. 2 Nr. 1 BetrKV",
            beispiele: ["Rechtsanwaltskosten", "Gerichtskosten", "Mahnkosten", "Kontoführungsgebühren", "Rechtsschutzversicherung"],
            grund: "Zählen zur Verwaltung oder sind nicht durch den Gebrauch veranlasst."),

        Kostenartinfo("sonstige_nicht",
            bezeichnung: "Sonstige nicht umlagefähige Kosten",
            rechtsgrundlage: "§ 1, § 2 BetrKV",
            beispiele: ["Kabel-TV-Sammelvertrag ab 01.07.2024", "Reparaturanteil Hausmeister", "Abschreibungen", "Zinsen"],
            grund: "Die Kostenart ist im Katalog des § 2 BetrKV nicht enthalten."),
    ]

    static let alleArten: [Kostenartinfo] = betriebskosten + nichtUmlagefaehig

    private static let verzeichnis: [String: Kostenartinfo] =
        Dictionary(uniqueKeysWithValues: alleArten.map { ($0.id, $0) })

    static func art(_ id: String) -> Kostenartinfo? { verzeichnis[id] }

    static func istUmlagefaehigeArt(_ id: String) -> Bool {
        verzeichnis[id]?.istUmlagefaehigeArt ?? false
    }

    static func bezeichnung(_ id: String) -> String { verzeichnis[id]?.bezeichnung ?? id }

    /// Kostenarten, die über die Heizkostenverordnung abgerechnet werden.
    static let heizarten: Set<String> = ["heizung", "warmwasser", "verbundene_anlage"]
}
