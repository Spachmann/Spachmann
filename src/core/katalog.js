/**
 * Kostenarten-Katalog.
 *
 * Umlagefähige Positionen: abschließender Katalog des § 2 BetrKV
 * (Betriebskostenverordnung). Was dort nicht steht, ist nicht umlagefähig —
 * Ausnahme: § 2 Nr. 17 "sonstige Betriebskosten", die aber im Mietvertrag
 * konkret benannt sein müssen (BGH VIII ZR 137/09).
 *
 * Nicht umlagefähige Positionen: § 1 Abs. 2 BetrKV (Verwaltungskosten,
 * Instandhaltung/Instandsetzung) sowie das, was schon begrifflich keine
 * Betriebskosten nach § 1 Abs. 1 BetrKV sind (keine laufend entstehenden
 * Kosten des bestimmungsgemäßen Gebrauchs).
 */

export const SCHLUESSEL = {
  FLAECHE: 'flaeche',
  PERSONEN: 'personen',
  EINHEITEN: 'einheiten',
  MEA: 'mea',
  VERBRAUCH_WASSER: 'verbrauch_wasser',
  DIREKT: 'direkt',
  HEIZUNG: 'heizung',
};

export const SCHLUESSEL_INFO = {
  [SCHLUESSEL.FLAECHE]: {
    kurz: 'Wohnfläche',
    bezeichnung: 'Anteil der Wohnfläche an der Gesamtwohnfläche',
    einheit: 'm²',
    rechtsgrundlage: '§ 556a Abs. 1 Satz 1 BGB (gesetzlicher Auffangschlüssel)',
    zeitanteilig: true,
  },
  [SCHLUESSEL.PERSONEN]: {
    kurz: 'Personenzahl',
    bezeichnung: 'Anteil der im Zeitraum wohnenden Personen (Personentage)',
    einheit: 'Pers.',
    rechtsgrundlage: 'vertraglich vereinbarter Umlagemaßstab, § 556a Abs. 1 BGB',
    zeitanteilig: true,
  },
  [SCHLUESSEL.EINHEITEN]: {
    kurz: 'Wohneinheiten',
    bezeichnung: 'gleichmäßig nach Anzahl der Wohneinheiten',
    einheit: 'Einheit',
    rechtsgrundlage: 'vertraglich vereinbarter Umlagemaßstab, § 556a Abs. 1 BGB',
    zeitanteilig: true,
  },
  [SCHLUESSEL.MEA]: {
    kurz: 'Miteigentumsanteile',
    bezeichnung: 'Anteil nach Miteigentumsanteilen (MEA)',
    einheit: 'MEA',
    rechtsgrundlage: 'vertraglich vereinbarter Umlagemaßstab, § 556a Abs. 1 BGB',
    zeitanteilig: true,
  },
  [SCHLUESSEL.VERBRAUCH_WASSER]: {
    kurz: 'Verbrauch',
    bezeichnung: 'erfasster Wasserverbrauch laut Zwischenzähler',
    einheit: 'm³',
    rechtsgrundlage: '§ 556a Abs. 1 Satz 2 BGB (Erfassungspflicht bei Verbrauchserfassung)',
    zeitanteilig: false,
  },
  [SCHLUESSEL.DIREKT]: {
    kurz: 'Direktzuordnung',
    bezeichnung: 'Kosten werden einer Einheit unmittelbar zugeordnet',
    einheit: '',
    rechtsgrundlage: 'verursachungsgerechte Zuordnung',
    zeitanteilig: true,
  },
  [SCHLUESSEL.HEIZUNG]: {
    kurz: 'Heizkostenverordnung',
    bezeichnung: 'Abrechnung nach HeizkostenV (Grund- und Verbrauchsanteil)',
    einheit: '',
    rechtsgrundlage: '§§ 6–9 HeizkostenV',
    zeitanteilig: false,
  },
};

/**
 * Der Katalog des § 2 BetrKV.
 * `warnung` markiert Positionen, die zwar dem Grunde nach umlagefähig sind,
 * bei denen aber typischerweise ein nicht umlagefähiger Anteil herauszurechnen
 * ist oder eine zusätzliche Voraussetzung gilt.
 */
export const BETRIEBSKOSTEN = [
  {
    id: 'grundsteuer',
    nr: 1,
    bezeichnung: 'Laufende öffentliche Lasten des Grundstücks (Grundsteuer)',
    rechtsgrundlage: '§ 2 Nr. 1 BetrKV',
    schluessel: SCHLUESSEL.FLAECHE,
    beispiele: ['Grundsteuer B', 'Deichabgaben'],
  },
  {
    id: 'wasser',
    nr: 2,
    bezeichnung: 'Kosten der Wasserversorgung',
    rechtsgrundlage: '§ 2 Nr. 2 BetrKV',
    schluessel: SCHLUESSEL.VERBRAUCH_WASSER,
    beispiele: ['Frischwasser', 'Grundgebühr Wasser', 'Zählermiete', 'Eichung', 'Wasseraufbereitung'],
    warnung: 'Sind Wasserzähler vorhanden, ist verbrauchsabhängig abzurechnen (§ 556a Abs. 1 Satz 2 BGB).',
  },
  {
    id: 'entwaesserung',
    nr: 3,
    bezeichnung: 'Kosten der Entwässerung',
    rechtsgrundlage: '§ 2 Nr. 3 BetrKV',
    schluessel: SCHLUESSEL.VERBRAUCH_WASSER,
    beispiele: ['Schmutzwassergebühr', 'Niederschlagswassergebühr', 'Entleerung Kleinkläranlage'],
  },
  {
    id: 'heizung',
    nr: 4,
    bezeichnung: 'Kosten des Betriebs der zentralen Heizungsanlage',
    rechtsgrundlage: '§ 2 Nr. 4 lit. a–c BetrKV, HeizkostenV',
    schluessel: SCHLUESSEL.HEIZUNG,
    beispiele: ['Brennstoff', 'Betriebsstrom', 'Wartung', 'Abgasmessung', 'Messdienst', 'Fernwärme'],
    hinweis: 'Wird über den Reiter „Heizung & Warmwasser" nach HeizkostenV abgerechnet.',
  },
  {
    id: 'warmwasser',
    nr: 5,
    bezeichnung: 'Kosten der Warmwasserversorgung',
    rechtsgrundlage: '§ 2 Nr. 5 BetrKV, HeizkostenV',
    schluessel: SCHLUESSEL.HEIZUNG,
    beispiele: ['Brennstoff Warmwasser', 'Betriebsstrom', 'Wartung', 'Legionellenprüfung'],
    hinweis: 'Wird über den Reiter „Heizung & Warmwasser" nach HeizkostenV abgerechnet.',
  },
  {
    id: 'verbundene_anlage',
    nr: 6,
    bezeichnung: 'Kosten verbundener Heizungs- und Warmwasserversorgungsanlagen',
    rechtsgrundlage: '§ 2 Nr. 6 BetrKV, § 9 HeizkostenV',
    schluessel: SCHLUESSEL.HEIZUNG,
    beispiele: ['gemeinsame Erzeugung von Heizwärme und Warmwasser'],
    hinweis: 'Aufteilung nach § 9 HeizkostenV im Reiter „Heizung & Warmwasser".',
  },
  {
    id: 'aufzug',
    nr: 7,
    bezeichnung: 'Kosten des Betriebs des Personen- oder Lastenaufzugs',
    rechtsgrundlage: '§ 2 Nr. 7 BetrKV',
    schluessel: SCHLUESSEL.FLAECHE,
    beispiele: ['Betriebsstrom', 'Wartung', 'Notrufbereitschaft', 'TÜV-Prüfung', 'Reinigung'],
    warnung: 'Reparaturen an der Aufzugsanlage sind Instandsetzung und nicht umlagefähig.',
  },
  {
    id: 'strassenreinigung_muell',
    nr: 8,
    bezeichnung: 'Kosten der Straßenreinigung und Müllbeseitigung',
    rechtsgrundlage: '§ 2 Nr. 8 BetrKV',
    schluessel: SCHLUESSEL.PERSONEN,
    beispiele: ['Straßenreinigungsgebühr', 'Winterdienst', 'Restmüll', 'Bio-/Papiertonne', 'Sperrmüll', 'Müllschleuse'],
  },
  {
    id: 'gebaeudereinigung',
    nr: 9,
    bezeichnung: 'Kosten der Gebäudereinigung und Ungezieferbekämpfung',
    rechtsgrundlage: '§ 2 Nr. 9 BetrKV',
    schluessel: SCHLUESSEL.FLAECHE,
    beispiele: ['Treppenhausreinigung', 'Reinigung Tiefgarage', 'Glasreinigung', 'Schädlingsbekämpfung'],
    warnung: 'Ungezieferbekämpfung nur als laufende Vorsorge; einmalige Beseitigung eines Befalls ist Instandsetzung.',
    lohnanteilTyp: 'haushaltsnah',
  },
  {
    id: 'gartenpflege',
    nr: 10,
    bezeichnung: 'Kosten der Gartenpflege',
    rechtsgrundlage: '§ 2 Nr. 10 BetrKV',
    schluessel: SCHLUESSEL.FLAECHE,
    beispiele: ['Rasenmähen', 'Baum-/Heckenschnitt', 'Pflanzen ersetzen', 'Spielplatzpflege'],
    warnung: 'Neuanlage eines Gartens ist nicht umlagefähig, nur die laufende Pflege und Erneuerung abgängiger Pflanzen.',
    lohnanteilTyp: 'haushaltsnah',
  },
  {
    id: 'beleuchtung',
    nr: 11,
    bezeichnung: 'Kosten der Beleuchtung',
    rechtsgrundlage: '§ 2 Nr. 11 BetrKV',
    schluessel: SCHLUESSEL.FLAECHE,
    beispiele: ['Allgemeinstrom Treppenhaus', 'Außenbeleuchtung', 'Keller', 'Tiefgarage'],
    warnung: 'Nur Stromkosten; Austausch defekter Leuchtmittel ist strittig, Neuinstallation ist nicht umlagefähig.',
  },
  {
    id: 'schornsteinreinigung',
    nr: 12,
    bezeichnung: 'Kosten der Schornsteinreinigung',
    rechtsgrundlage: '§ 2 Nr. 12 BetrKV',
    schluessel: SCHLUESSEL.FLAECHE,
    beispiele: ['Kehrgebühren', 'Feuerstättenschau'],
    warnung: 'Soweit bereits in den Heizkosten nach Nr. 4 enthalten, hier nicht nochmals ansetzen.',
  },
  {
    id: 'versicherung',
    nr: 13,
    bezeichnung: 'Kosten der Sach- und Haftpflichtversicherung',
    rechtsgrundlage: '§ 2 Nr. 13 BetrKV',
    schluessel: SCHLUESSEL.FLAECHE,
    beispiele: ['Wohngebäudeversicherung', 'Haus- und Grundbesitzerhaftpflicht', 'Elementarschaden', 'Öltank', 'Glasversicherung'],
    warnung: 'Rechtsschutz-, Mietausfall- und Hausratversicherung des Vermieters sind nicht umlagefähig.',
  },
  {
    id: 'hauswart',
    nr: 14,
    bezeichnung: 'Kosten für den Hauswart',
    rechtsgrundlage: '§ 2 Nr. 14 BetrKV',
    schluessel: SCHLUESSEL.FLAECHE,
    beispiele: ['Vergütung', 'Sozialbeiträge', 'geldwerte Leistungen'],
    warnung:
      'Anteile für Instandhaltung, Instandsetzung, Erneuerung, Schönheitsreparaturen und Verwaltung müssen herausgerechnet werden (§ 2 Nr. 14 Halbsatz 2 BetrKV). Erfasse sie unten als „nicht umlagefähiger Abzug".',
    lohnanteilTyp: 'haushaltsnah',
  },
  {
    id: 'antenne_breitband',
    nr: 15,
    bezeichnung: 'Kosten des Betriebs der Gemeinschafts-Antennenanlage / des Breitbandnetzes',
    rechtsgrundlage: '§ 2 Nr. 15 BetrKV',
    schluessel: SCHLUESSEL.EINHEITEN,
    beispiele: ['Betrieb Gemeinschaftsantenne', 'Glasfaserbereitstellungsentgelt (§ 72 TKG)'],
    warnung:
      'Das TV-Nebenkostenprivileg ist zum 30.06.2024 entfallen: Entgelte für Kabel-TV-Sammelverträge sind seit 01.07.2024 nicht mehr als Betriebskosten umlagefähig. Umlagefähig bleiben der Betrieb einer eigenen Gemeinschaftsantenne sowie unter den Voraussetzungen des § 72 TKG das Glasfaser-Bereitstellungsentgelt.',
  },
  {
    id: 'waeschepflege',
    nr: 16,
    bezeichnung: 'Kosten des Betriebs der Einrichtungen für die Wäschepflege',
    rechtsgrundlage: '§ 2 Nr. 16 BetrKV',
    schluessel: SCHLUESSEL.EINHEITEN,
    beispiele: ['Strom', 'Wartung Waschmaschine/Trockner', 'Wasserkosten Waschküche'],
  },
  {
    id: 'sonstige',
    nr: 17,
    bezeichnung: 'Sonstige Betriebskosten',
    rechtsgrundlage: '§ 2 Nr. 17 BetrKV',
    schluessel: SCHLUESSEL.FLAECHE,
    beispiele: ['Wartung Rauchwarnmelder', 'Wartung Lüftungsanlage', 'Dachrinnenreinigung', 'Sicherheitsdienst', 'Wartung Feuerlöscher'],
    warnung:
      'Nur umlagefähig, wenn die konkrete Kostenart im Mietvertrag ausdrücklich benannt ist. Eine pauschale Klausel „sonstige Betriebskosten" genügt nicht (BGH VIII ZR 137/09).',
    vertragBenennungNoetig: true,
  },
];

/**
 * Typische nicht umlagefähige Kosten. Sie werden in der App miterfasst,
 * aber niemals auf Mieter umgelegt — sie erscheinen ausschließlich in der
 * internen Vermieterübersicht.
 */
export const NICHT_UMLAGEFAEHIG = [
  {
    id: 'verwaltung',
    bezeichnung: 'Verwaltungskosten',
    rechtsgrundlage: '§ 1 Abs. 2 Nr. 1 BetrKV',
    grund: 'Verwaltungskosten sind ausdrücklich keine Betriebskosten.',
    beispiele: ['Hausverwaltervergütung', 'Kosten der Geschäftsführung', 'Kontoführung', 'Buchhaltung', 'Steuerberater', 'Porto/Telefon der Verwaltung', 'Erstellung der Betriebskostenabrechnung'],
  },
  {
    id: 'instandhaltung',
    bezeichnung: 'Instandhaltung und Instandsetzung',
    rechtsgrundlage: '§ 1 Abs. 2 Nr. 2 BetrKV',
    grund: 'Erhaltungsaufwand trägt nach § 535 Abs. 1 Satz 2 BGB der Vermieter.',
    beispiele: ['Reparaturen', 'Malerarbeiten', 'Dachsanierung', 'Austausch defekter Bauteile', 'Rohrbruchbeseitigung'],
  },
  {
    id: 'ruecklage',
    bezeichnung: 'Zuführung zur Instandhaltungsrücklage',
    rechtsgrundlage: '§ 1 Abs. 2 Nr. 2 BetrKV analog',
    grund: 'Rücklagenzuführungen der WEG sind kein laufender Betriebsaufwand.',
    beispiele: ['Erhaltungsrücklage nach WEG-Abrechnung'],
  },
  {
    id: 'mietausfallwagnis',
    bezeichnung: 'Mietausfallwagnis und Leerstandskosten',
    rechtsgrundlage: '§ 1 Abs. 2 BetrKV, § 556 Abs. 1 BGB',
    grund: 'Das Vermietungsrisiko trägt der Vermieter; Leerstandsanteile bleiben bei ihm.',
    beispiele: ['Mietausfall', 'Betriebskosten leerstehender Einheiten'],
  },
  {
    id: 'anschaffung',
    bezeichnung: 'Anschaffungs- und Herstellungskosten',
    rechtsgrundlage: '§ 1 Abs. 1 BetrKV (keine laufenden Kosten)',
    grund: 'Einmalige Investitionen sind keine laufend entstehenden Betriebskosten.',
    beispiele: ['Erstanschaffung Rauchwarnmelder', 'Neuanlage Garten', 'Anschaffung Mülltonnen', 'Baukostenzuschuss'],
  },
  {
    id: 'rechtskosten',
    bezeichnung: 'Rechts- und Bankkosten',
    rechtsgrundlage: '§ 1 Abs. 2 Nr. 1 BetrKV',
    grund: 'Zählen zur Verwaltung bzw. sind nicht durch den Gebrauch veranlasst.',
    beispiele: ['Rechtsanwaltskosten', 'Gerichtskosten', 'Mahnkosten', 'Kontoführungsgebühren', 'Rechtsschutzversicherung'],
  },
  {
    id: 'sonstige_nicht',
    bezeichnung: 'Sonstige nicht umlagefähige Kosten',
    rechtsgrundlage: '§ 1, § 2 BetrKV',
    grund: 'Kostenart ist im Katalog des § 2 BetrKV nicht enthalten.',
    beispiele: ['Kabel-TV-Sammelvertrag ab 01.07.2024', 'Reparaturanteil Hausmeister', 'Abschreibungen', 'Zinsen'],
  },
];

const BETRIEBSKOSTEN_INDEX = new Map(BETRIEBSKOSTEN.map((k) => [k.id, k]));
const NICHT_INDEX = new Map(NICHT_UMLAGEFAEHIG.map((k) => [k.id, k]));

export function kostenart(id) {
  return BETRIEBSKOSTEN_INDEX.get(id) || NICHT_INDEX.get(id) || null;
}

export function istUmlagefaehigeArt(id) {
  return BETRIEBSKOSTEN_INDEX.has(id);
}

/** Kostenarten, die über die HeizkostenV abgerechnet werden. */
export const HEIZ_ARTEN = new Set(['heizung', 'warmwasser', 'verbundene_anlage']);

export function bezeichnungVon(id) {
  const art = kostenart(id);
  return art ? art.bezeichnung : id;
}
