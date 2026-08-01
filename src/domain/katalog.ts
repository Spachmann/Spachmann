/**
 * Kostenartenkatalog.
 *
 * Umlagefähige Betriebskosten ergeben sich abschließend aus § 2 BetrKV. Alles,
 * was dort nicht aufgeführt ist, darf nur als "sonstige Betriebskosten"
 * (§ 2 Nr. 17 BetrKV) und nur bei ausdrücklicher Vereinbarung im Mietvertrag
 * umgelegt werden. Verwaltungs- und Instandhaltungskosten sind nach
 * § 1 Abs. 2 BetrKV ausdrücklich keine Betriebskosten.
 */

import type { ISODate, Verteilerschluessel, Zaehlerart } from './types';

export type Kostengruppe = 'BETRKV' | 'HEIZKOSTEN' | 'NICHT_UMLAGEFAEHIG';

export interface Kostenart {
  id: string;
  /** Fundstelle, z. B. "§ 2 Nr. 1 BetrKV" */
  fundstelle: string;
  bezeichnung: string;
  beschreibung: string;
  umlagefaehig: boolean;
  gruppe: Kostengruppe;
  standardSchluessel: Verteilerschluessel;
  erlaubteSchluessel: Verteilerschluessel[];
  /** Vorbelegung der Zählerart, wenn nach Verbrauch abgerechnet wird */
  verbrauchsart?: Zaehlerart;
  hinweis?: string;
  /** Position ist nur für Abrechnungszeiträume umlagefähig, die vor diesem Datum enden. */
  umlagefaehigBis?: ISODate;
  /** Umlage setzt eine ausdrückliche Vereinbarung im Mietvertrag voraus. */
  benoetigtVereinbarung?: boolean;
  /** Enthält typischerweise haushaltsnahe Dienstleistungen i. S. d. § 35a EStG. */
  arbeitskostenRelevant?: boolean;
  /** Jährlicher Höchstbetrag je Wohnung in Cent (z. B. Glasfaserbereitstellungsentgelt) */
  hoechstbetragProWohnungUndJahr?: number;
}

const ALLE_UMLAGE_SCHLUESSEL: Verteilerschluessel[] = [
  'WOHNFLAECHE',
  'PERSONENZAHL',
  'WOHNEINHEIT',
  'MITEIGENTUMSANTEIL',
  'VERBRAUCH',
  'DIREKTZUORDNUNG',
];

// ---------------------------------------------------------------------------
// § 2 BetrKV – abschließender Katalog der umlagefähigen Betriebskosten
// ---------------------------------------------------------------------------

export const BETRIEBSKOSTEN: Kostenart[] = [
  {
    id: 'BETRKV_2_1',
    fundstelle: '§ 2 Nr. 1 BetrKV',
    bezeichnung: 'Laufende öffentliche Lasten des Grundstücks (Grundsteuer)',
    beschreibung:
      'Namentlich die Grundsteuer. Nicht umlagefähig sind einmalige Abgaben wie Erschließungsbeiträge.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNFLAECHE',
    erlaubteSchluessel: ['WOHNFLAECHE', 'MITEIGENTUMSANTEIL', 'WOHNEINHEIT', 'DIREKTZUORDNUNG'],
  },
  {
    id: 'BETRKV_2_2',
    fundstelle: '§ 2 Nr. 2 BetrKV',
    bezeichnung: 'Wasserversorgung',
    beschreibung:
      'Wasserverbrauch, Grundgebühren, Miete und Wartung von Wasserzählern, Betrieb einer Hauswasserversorgungs- und Wasseraufbereitungsanlage.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'VERBRAUCH',
    erlaubteSchluessel: ALLE_UMLAGE_SCHLUESSEL,
    verbrauchsart: 'KALTWASSER',
  },
  {
    id: 'BETRKV_2_3',
    fundstelle: '§ 2 Nr. 3 BetrKV',
    bezeichnung: 'Entwässerung',
    beschreibung:
      'Gebühren für Haus- und Grundstücksentwässerung, Niederschlagswasser, Betrieb einer Entwässerungspumpe.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'VERBRAUCH',
    erlaubteSchluessel: ALLE_UMLAGE_SCHLUESSEL,
    verbrauchsart: 'KALTWASSER',
  },
  {
    id: 'BETRKV_2_4A',
    fundstelle: '§ 2 Nr. 4 lit. a BetrKV',
    bezeichnung: 'Betrieb der zentralen Heizungsanlage',
    beschreibung:
      'Brennstoffe, Betriebsstrom, Bedienung, Überwachung, Pflege, Reinigung, Prüfung der Betriebsbereitschaft und -sicherheit, Immissionsschutzmessungen, Wartung, Kosten der Verbrauchserfassung und Abrechnung.',
    umlagefaehig: true,
    gruppe: 'HEIZKOSTEN',
    standardSchluessel: 'HEIZKOSTENV',
    erlaubteSchluessel: ['HEIZKOSTENV'],
    hinweis: 'Verteilung zwingend nach HeizkostenV (50–70 % verbrauchsabhängig).',
    arbeitskostenRelevant: true,
  },
  {
    id: 'BETRKV_2_5',
    fundstelle: '§ 2 Nr. 5 BetrKV',
    bezeichnung: 'Betrieb der Warmwasserversorgungsanlage',
    beschreibung:
      'Wasserversorgung und Erwärmung entsprechend Nr. 2 und Nr. 4 lit. a, einschließlich Verbrauchserfassung.',
    umlagefaehig: true,
    gruppe: 'HEIZKOSTEN',
    standardSchluessel: 'HEIZKOSTENV',
    erlaubteSchluessel: ['HEIZKOSTENV'],
    hinweis: 'Verteilung zwingend nach HeizkostenV.',
    arbeitskostenRelevant: true,
  },
  {
    id: 'BETRKV_2_6',
    fundstelle: '§ 2 Nr. 6 BetrKV',
    bezeichnung: 'Verbundene Heiz- und Warmwasserversorgungsanlagen',
    beschreibung:
      'Kosten einer Anlage, die Heizung und Warmwasser gemeinsam erzeugt. Der Warmwasseranteil ist nach § 9 HeizkostenV vorab abzutrennen.',
    umlagefaehig: true,
    gruppe: 'HEIZKOSTEN',
    standardSchluessel: 'HEIZKOSTENV',
    erlaubteSchluessel: ['HEIZKOSTENV'],
    hinweis: 'Aufteilung Heizung/Warmwasser nach § 9 HeizkostenV erforderlich.',
    arbeitskostenRelevant: true,
  },
  {
    id: 'BETRKV_2_7',
    fundstelle: '§ 2 Nr. 7 BetrKV',
    bezeichnung: 'Betrieb des Personen- oder Lastenaufzugs',
    beschreibung:
      'Betriebsstrom, Beaufsichtigung, Bedienung, Überwachung, Pflege, regelmäßige Prüfung der Betriebsbereitschaft und -sicherheit, Reinigung der Anlage.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNFLAECHE',
    erlaubteSchluessel: ['WOHNFLAECHE', 'WOHNEINHEIT', 'PERSONENZAHL', 'MITEIGENTUMSANTEIL'],
    hinweis:
      'Erdgeschossmieter können nach der Rechtsprechung grundsätzlich mitbelastet werden, sofern der Mietvertrag nichts anderes regelt.',
    arbeitskostenRelevant: true,
  },
  {
    id: 'BETRKV_2_8',
    fundstelle: '§ 2 Nr. 8 BetrKV',
    bezeichnung: 'Straßenreinigung und Müllbeseitigung',
    beschreibung:
      'Gebühren für Straßenreinigung und Winterdienst, Müllabfuhr, Betrieb von Müllschluckern und Müllmengenerfassungsanlagen.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNFLAECHE',
    erlaubteSchluessel: ALLE_UMLAGE_SCHLUESSEL,
    hinweis: 'Bei Restmüll ist auch ein Personen- oder Verbrauchsmaßstab zulässig.',
    arbeitskostenRelevant: true,
  },
  {
    id: 'BETRKV_2_9',
    fundstelle: '§ 2 Nr. 9 BetrKV',
    bezeichnung: 'Gebäudereinigung und Ungezieferbekämpfung',
    beschreibung:
      'Reinigung der von allen Bewohnern genutzten Gebäudeteile (Zugänge, Flure, Treppen, Keller, Waschküche, Aufzug) sowie Ungezieferbekämpfung.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNFLAECHE',
    erlaubteSchluessel: ALLE_UMLAGE_SCHLUESSEL,
    hinweis:
      'Nur laufende Bekämpfung; eine einmalige Beseitigung eines Befalls ist Instandsetzung und nicht umlagefähig.',
    arbeitskostenRelevant: true,
  },
  {
    id: 'BETRKV_2_10',
    fundstelle: '§ 2 Nr. 10 BetrKV',
    bezeichnung: 'Gartenpflege',
    beschreibung:
      'Pflege gärtnerisch angelegter Flächen, Erneuerung von Pflanzen und Gehölzen, Pflege von Spielplätzen und Zugängen.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNFLAECHE',
    erlaubteSchluessel: ['WOHNFLAECHE', 'WOHNEINHEIT', 'MITEIGENTUMSANTEIL', 'PERSONENZAHL'],
    hinweis:
      'Neuanlage eines Gartens ist nicht umlagefähig; nur Erneuerung im Rahmen der laufenden Pflege.',
    arbeitskostenRelevant: true,
  },
  {
    id: 'BETRKV_2_11',
    fundstelle: '§ 2 Nr. 11 BetrKV',
    bezeichnung: 'Beleuchtung',
    beschreibung:
      'Stromkosten der Außenbeleuchtung und der Beleuchtung gemeinschaftlich genutzter Gebäudeteile (Allgemeinstrom).',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNFLAECHE',
    erlaubteSchluessel: ALLE_UMLAGE_SCHLUESSEL,
  },
  {
    id: 'BETRKV_2_12',
    fundstelle: '§ 2 Nr. 12 BetrKV',
    bezeichnung: 'Schornsteinreinigung',
    beschreibung:
      'Kehrgebühren nach der Kehr- und Überprüfungsordnung, soweit nicht bereits unter Nr. 4 lit. a erfasst.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNFLAECHE',
    erlaubteSchluessel: ['WOHNFLAECHE', 'WOHNEINHEIT', 'MITEIGENTUMSANTEIL', 'DIREKTZUORDNUNG'],
    arbeitskostenRelevant: true,
  },
  {
    id: 'BETRKV_2_13',
    fundstelle: '§ 2 Nr. 13 BetrKV',
    bezeichnung: 'Sach- und Haftpflichtversicherung',
    beschreibung:
      'Versicherung des Gebäudes gegen Feuer-, Sturm-, Wasser- und sonstige Elementarschäden, Glasversicherung, Haftpflichtversicherung für Gebäude, Öltank und Aufzug.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNFLAECHE',
    erlaubteSchluessel: ['WOHNFLAECHE', 'WOHNEINHEIT', 'MITEIGENTUMSANTEIL'],
    hinweis: 'Rechtsschutz- und Mietausfallversicherung sind nicht umlagefähig.',
  },
  {
    id: 'BETRKV_2_14',
    fundstelle: '§ 2 Nr. 14 BetrKV',
    bezeichnung: 'Hauswart / Hausmeister',
    beschreibung:
      'Vergütung, Sozialbeiträge und geldwerte Leistungen für den Hauswart, soweit er keine Instandhaltungs-, Instandsetzungs- oder Verwaltungstätigkeiten ausübt.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNFLAECHE',
    erlaubteSchluessel: ['WOHNFLAECHE', 'WOHNEINHEIT', 'MITEIGENTUMSANTEIL', 'PERSONENZAHL'],
    hinweis:
      'Der auf Instandhaltung, Instandsetzung, Erneuerung und Verwaltung entfallende Anteil ist vorweg abzuziehen (Vorwegabzug).',
    arbeitskostenRelevant: true,
  },
  {
    id: 'BETRKV_2_15A',
    fundstelle: '§ 2 Nr. 15 lit. a BetrKV',
    bezeichnung: 'Betrieb der Gemeinschafts-Antennenanlage',
    beschreibung:
      'Betriebsstrom und laufende Prüfung der Betriebsbereitschaft der hauseigenen Antennen-/Satellitenanlage.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNEINHEIT',
    erlaubteSchluessel: ['WOHNEINHEIT', 'WOHNFLAECHE', 'MITEIGENTUMSANTEIL'],
  },
  {
    id: 'BETRKV_2_15B',
    fundstelle: '§ 2 Nr. 15 lit. b BetrKV a. F.',
    bezeichnung: 'Kabelanschluss / laufende Entgelte für Breitbandanschluss',
    beschreibung:
      'Monatliche Entgelte an den TV-Kabelanbieter im Sammelinkasso ("Nebenkostenprivileg").',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNEINHEIT',
    erlaubteSchluessel: ['WOHNEINHEIT', 'WOHNFLAECHE'],
    umlagefaehigBis: '2024-06-30',
    hinweis:
      'Das Nebenkostenprivileg ist zum 30.06.2024 entfallen (§ 230 Abs. 5 TKG). Für Zeiträume danach sind laufende Kabelentgelte nicht mehr über die Betriebskosten umlagefähig.',
  },
  {
    id: 'BETRKV_2_15C',
    fundstelle: '§ 2 Nr. 15 lit. c BetrKV',
    bezeichnung: 'Glasfaserbereitstellungsentgelt',
    beschreibung:
      'Bereitstellungsentgelt für eine gebäudeinterne Glasfaserinfrastruktur nach § 72 Abs. 1 TKG.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNEINHEIT',
    erlaubteSchluessel: ['WOHNEINHEIT'],
    hoechstbetragProWohnungUndJahr: 6000,
    hinweis:
      'Höchstens 60 € je Wohnung und Jahr, längstens für 5 Jahre (in Ausnahmefällen 9 Jahre) ab Inbetriebnahme.',
  },
  {
    id: 'BETRKV_2_16',
    fundstelle: '§ 2 Nr. 16 BetrKV',
    bezeichnung: 'Betrieb der Einrichtungen für die Wäschepflege',
    beschreibung:
      'Betriebsstrom, Überwachung, Pflege, Reinigung und regelmäßige Prüfung der Waschküche und ihrer Geräte, Wasserkosten.',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNEINHEIT',
    erlaubteSchluessel: ALLE_UMLAGE_SCHLUESSEL,
  },
  {
    id: 'BETRKV_2_17',
    fundstelle: '§ 2 Nr. 17 BetrKV',
    bezeichnung: 'Sonstige Betriebskosten',
    beschreibung:
      'Weitere laufende Betriebskosten, die von Nr. 1–16 nicht erfasst sind (z. B. Wartung von Rauchwarnmeldern, Dachrinnenreinigung, Wartung der Lüftungsanlage, Blitzschutzprüfung).',
    umlagefaehig: true,
    gruppe: 'BETRKV',
    standardSchluessel: 'WOHNFLAECHE',
    erlaubteSchluessel: ALLE_UMLAGE_SCHLUESSEL,
    benoetigtVereinbarung: true,
    hinweis:
      'Nur umlagefähig, wenn die konkrete Kostenart im Mietvertrag ausdrücklich und einzeln benannt ist. Eine pauschale Bezugnahme auf "sonstige Betriebskosten" genügt nicht.',
    arbeitskostenRelevant: true,
  },
];

// ---------------------------------------------------------------------------
// Nicht umlagefähige Kosten (§ 1 Abs. 2 BetrKV und Rechtsprechung)
// ---------------------------------------------------------------------------

const nichtUmlagefaehig = (
  id: string,
  fundstelle: string,
  bezeichnung: string,
  beschreibung: string,
): Kostenart => ({
  id,
  fundstelle,
  bezeichnung,
  beschreibung,
  umlagefaehig: false,
  gruppe: 'NICHT_UMLAGEFAEHIG',
  standardSchluessel: 'WOHNFLAECHE',
  erlaubteSchluessel: ['WOHNFLAECHE'],
});

export const NICHT_UMLAGEFAEHIGE_KOSTEN: Kostenart[] = [
  nichtUmlagefaehig(
    'NU_VERWALTUNG',
    '§ 1 Abs. 2 Nr. 1 BetrKV',
    'Verwaltungskosten',
    'Kosten der Hausverwaltung, Geschäftsführung, Aufsicht, gesetzliche und freiwillige Prüfungen des Jahresabschlusses.',
  ),
  nichtUmlagefaehig(
    'NU_INSTANDHALTUNG',
    '§ 1 Abs. 2 Nr. 2 BetrKV',
    'Instandhaltung und Instandsetzung',
    'Kosten zur Beseitigung baulicher Mängel, Abnutzung und Alterung – einschließlich Reparaturen und Erneuerungen.',
  ),
  nichtUmlagefaehig(
    'NU_REPARATUR',
    'Rechtsprechung',
    'Reparaturen und Handwerkerrechnungen',
    'Einzelne Reparaturaufträge; auch der Reparaturanteil in Wartungsrechnungen ist herauszurechnen.',
  ),
  nichtUmlagefaehig(
    'NU_RUECKLAGE',
    'Rechtsprechung',
    'Zuführung zur Instandhaltungsrücklage',
    'Bei vermieteten Eigentumswohnungen ist die in der WEG-Abrechnung enthaltene Rücklagenzuführung nicht auf den Mieter umlegbar.',
  ),
  nichtUmlagefaehig(
    'NU_MIETAUSFALL',
    'Rechtsprechung',
    'Mietausfallwagnis und Leerstandskosten',
    'Auf leerstehende Einheiten entfallende Betriebskosten trägt der Vermieter selbst.',
  ),
  nichtUmlagefaehig(
    'NU_BANK',
    'Rechtsprechung',
    'Bank- und Kontoführungsgebühren',
    'Kontoführung, Überweisungs- und Lastschriftgebühren zählen zu den Verwaltungskosten.',
  ),
  nichtUmlagefaehig(
    'NU_RECHT',
    'Rechtsprechung',
    'Rechtsverfolgungs- und Rechtsberatungskosten',
    'Anwalts- und Gerichtskosten, Mahnkosten, Kosten der Mietersuche und Mietrechtsschutzversicherung.',
  ),
  nichtUmlagefaehig(
    'NU_NEUANSCHAFFUNG',
    'Rechtsprechung',
    'Neuanschaffungen und Erstherstellung',
    'Anschaffung neuer Anlagen und Geräte, Erstausstattung, bauliche Verbesserungen und Modernisierungen.',
  ),
  nichtUmlagefaehig(
    'NU_STEUERBERATUNG',
    'Rechtsprechung',
    'Steuerberatung und Buchhaltung',
    'Kosten der steuerlichen Beratung des Vermieters gehören zur Verwaltung.',
  ),
  nichtUmlagefaehig(
    'NU_VERBAND',
    'Rechtsprechung',
    'Verbands- und Vereinsbeiträge',
    'Mitgliedsbeiträge des Vermieters, z. B. an Eigentümerverbände.',
  ),
  nichtUmlagefaehig(
    'NU_SONSTIGE',
    '§ 1 Abs. 2 BetrKV',
    'Sonstige nicht umlagefähige Kosten',
    'Weitere Kosten, die der Vermieter selbst zu tragen hat.',
  ),
];

export const KOSTENARTEN: Kostenart[] = [...BETRIEBSKOSTEN, ...NICHT_UMLAGEFAEHIGE_KOSTEN];

const KOSTENART_INDEX = new Map(KOSTENARTEN.map((k) => [k.id, k]));

export function findeKostenart(id: string): Kostenart | undefined {
  return KOSTENART_INDEX.get(id);
}

/** Kostenart oder ein neutraler Platzhalter, damit die Anzeige nie leer bleibt. */
export function kostenartOderFallback(id: string): Kostenart {
  return (
    KOSTENART_INDEX.get(id) ?? {
      id,
      fundstelle: 'unbekannt',
      bezeichnung: 'Unbekannte Kostenart',
      beschreibung: '',
      umlagefaehig: false,
      gruppe: 'NICHT_UMLAGEFAEHIG',
      standardSchluessel: 'WOHNFLAECHE',
      erlaubteSchluessel: ['WOHNFLAECHE'],
    }
  );
}
