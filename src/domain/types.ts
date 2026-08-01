/**
 * Datenmodell der Betriebskosten-/Nebenkostenabrechnung.
 *
 * Rechtsgrundlagen:
 *  - § 556 BGB          Vereinbarung über Betriebskosten, Abrechnungsfrist
 *  - § 556a BGB         Abrechnungsmaßstab
 *  - BetrKV             Betriebskostenverordnung (Katalog des § 2)
 *  - HeizkostenV        Verordnung über Heizkostenabrechnung
 *
 * Alle Geldbeträge werden als ganzzahlige Cent-Werte geführt, damit bei der
 * Verteilung keine Gleitkomma-Rundungsfehler entstehen.
 */

export type UUID = string;
/** Datum im Format YYYY-MM-DD. */
export type ISODate = string;
/** Geldbetrag in Cent. */
export type Cent = number;

// ---------------------------------------------------------------------------
// Umlageschlüssel (§ 556a BGB)
// ---------------------------------------------------------------------------

export type Verteilerschluessel =
  /** Anteil der Wohnfläche an der Gesamtwohnfläche – gesetzlicher Regelmaßstab, § 556a Abs. 1 S. 1 BGB */
  | 'WOHNFLAECHE'
  /** Nach Personenzahl, zeitgewichtet als Personentage */
  | 'PERSONENZAHL'
  /** Nach Anzahl der Wohneinheiten (pro Einheit gleicher Anteil) */
  | 'WOHNEINHEIT'
  /** Nach erfasstem Verbrauch, § 556a Abs. 1 S. 2 BGB */
  | 'VERBRAUCH'
  /** Nach Miteigentumsanteilen (typisch bei WEG-Einheiten) */
  | 'MITEIGENTUMSANTEIL'
  /** Kosten fallen nur für eine bestimmte Einheit an und werden dieser direkt zugeordnet */
  | 'DIREKTZUORDNUNG'
  /** Heiz-/Warmwasserkosten – Verteilung zwingend nach HeizkostenV */
  | 'HEIZKOSTENV';

export const VERTEILERSCHLUESSEL_BEZEICHNUNG: Record<Verteilerschluessel, string> = {
  WOHNFLAECHE: 'Wohnfläche (m²)',
  PERSONENZAHL: 'Personenzahl (Personentage)',
  WOHNEINHEIT: 'Anzahl Wohneinheiten',
  VERBRAUCH: 'Erfasster Verbrauch',
  MITEIGENTUMSANTEIL: 'Miteigentumsanteil',
  DIREKTZUORDNUNG: 'Direkte Zuordnung zur Einheit',
  HEIZKOSTENV: 'Heiz-/Warmwasserkosten nach HeizkostenV',
};

/** Einheit, in der ein Verbrauchsmaßstab gemessen wird. */
export type Verbrauchseinheit = 'm3' | 'kWh' | 'Einheiten' | 'Stück';

// ---------------------------------------------------------------------------
// Stammdaten
// ---------------------------------------------------------------------------

export interface Anschrift {
  name: string;
  zusatz?: string;
  strasse: string;
  plz: string;
  ort: string;
}

export interface Vermieter extends Anschrift {
  telefon?: string;
  email?: string;
  /** Für die Zahlungsaufforderung bzw. Guthabenerstattung */
  iban?: string;
  bic?: string;
  kreditinstitut?: string;
  kontoinhaber?: string;
  /** Optional: Steuernummer für § 35a EStG-Bescheinigung */
  steuernummer?: string;
}

export interface Objekt {
  id: UUID;
  bezeichnung: string;
  strasse: string;
  plz: string;
  ort: string;
  /** Baujahr – nur informativ */
  baujahr?: number;
  vermieter: Vermieter;
  /**
   * Fiktive Personenzahl, die einer leerstehenden Einheit beim Personenschlüssel
   * zugerechnet wird, damit der Leerstandsanteil beim Vermieter verbleibt.
   */
  leerstandPersonenFiktiv: number;
}

export interface Einheit {
  id: UUID;
  objektId: UUID;
  bezeichnung: string;
  /** Wohnfläche in m² (Grundlage des Regelmaßstabs) */
  wohnflaecheQm: number;
  lage?: string;
  zimmer?: number;
  /** Miteigentumsanteil (z. B. Tausendstel), nur bei entsprechendem Schlüssel nötig */
  miteigentumsanteil?: number;
  /** Gewerbeeinheit – relevant für Vorwegabzug */
  gewerbe?: boolean;
}

/** Zeitraum mit einer bestimmten Personenzahl im Haushalt. */
export interface PersonenzahlZeitraum {
  von: ISODate;
  bis: ISODate;
  anzahl: number;
}

export interface Mietverhaeltnis {
  id: UUID;
  einheitId: UUID;
  /** Alle Mieter der Einheit – die Abrechnung muss an sämtliche Mieter gerichtet sein. */
  mieter: string[];
  /** Abweichende Zustellanschrift (z. B. nach Auszug) */
  zustellanschrift?: Anschrift;
  beginn: ISODate;
  /** Undefiniert = laufendes Mietverhältnis */
  ende?: ISODate;
  personenzahlen: PersonenzahlZeitraum[];
  /** Monatliche Vorauszahlung auf die kalten Betriebskosten */
  vorauszahlungBetriebskostenMonatlich: Cent;
  /** Monatliche Vorauszahlung auf Heiz-/Warmwasserkosten (0, wenn in obiger enthalten) */
  vorauszahlungHeizkostenMonatlich: Cent;
  /**
   * Tatsächlich geleistete Vorauszahlungen im Abrechnungszeitraum. Wenn gesetzt,
   * überschreibt dieser Wert die rechnerische Ermittlung (monatlich × Monate).
   * Schlüssel: ID des Abrechnungszeitraums.
   */
  vorauszahlungenTatsaechlich?: Record<UUID, Cent>;
  /**
   * Der Mietvertrag enthält eine wirksame Umlagevereinbarung nach § 556 Abs. 1 BGB.
   * Ohne sie sind Betriebskosten nicht umlagefähig.
   */
  umlageVereinbart: boolean;
  /** Der Mietvertrag vereinbart ausdrücklich auch "sonstige Betriebskosten" (§ 2 Nr. 17 BetrKV). */
  sonstigeBetriebskostenVereinbart: boolean;
  /** Pauschale statt Vorauszahlung: dann ist keine Abrechnung geschuldet (§ 556 Abs. 2 BGB). */
  betriebskostenpauschale?: boolean;
  anmerkung?: string;
}

// ---------------------------------------------------------------------------
// Abrechnungszeitraum und Kosten
// ---------------------------------------------------------------------------

export interface Abrechnungszeitraum {
  id: UUID;
  objektId: UUID;
  bezeichnung: string;
  von: ISODate;
  bis: ISODate;
  /** Datum, an dem die Abrechnung dem Mieter zugeht (maßgeblich für § 556 Abs. 3 S. 2 BGB) */
  zugangDatum?: ISODate;
  abgeschlossen?: boolean;
}

export interface Kostenposition {
  id: UUID;
  abrechnungszeitraumId: UUID;
  /** Verweis in den Kostenartenkatalog (BetrKV bzw. nicht umlagefähige Kosten) */
  katalogId: string;
  /** Freie Bezeichnung; per Vorgabe die Katalogbezeichnung */
  bezeichnung: string;
  /** Gesamtbetrag der Position (brutto) */
  betrag: Cent;
  verteilerschluessel: Verteilerschluessel;
  /** Bei DIREKTZUORDNUNG: betroffene Einheit */
  direktEinheitId?: UUID;
  /** Bei VERBRAUCH: welcher Zählerart der Verbrauch entnommen wird */
  verbrauchsart?: Zaehlerart;
  /**
   * Vorwegabzug: Teil des Betrags, der nicht umlagefähig ist (z. B. Instandhaltungs-
   * und Verwaltungsanteil in einer Hauswart- oder Gartenpflegerechnung, Gewerbeanteil).
   */
  nichtUmlagefaehigerAnteil?: Cent;
  begruendungVorwegabzug?: string;
  /** Anteil der Arbeitskosten für die Bescheinigung nach § 35a EStG */
  arbeitskostenAnteil?: Cent;
  belegnummer?: string;
  belegdatum?: ISODate;
  anmerkung?: string;
}

// ---------------------------------------------------------------------------
// Verbrauchserfassung
// ---------------------------------------------------------------------------

export type Zaehlerart = 'HEIZUNG' | 'WARMWASSER' | 'KALTWASSER' | 'SONSTIG';

export const ZAEHLERART_BEZEICHNUNG: Record<Zaehlerart, string> = {
  HEIZUNG: 'Heizung (Heizkostenverteiler / Wärmemenge)',
  WARMWASSER: 'Warmwasser',
  KALTWASSER: 'Kaltwasser',
  SONSTIG: 'Sonstiger Zähler',
};

export interface Verbrauch {
  id: UUID;
  abrechnungszeitraumId: UUID;
  /** Verbrauch wird dem konkreten Mietverhältnis zugeordnet (wichtig bei Mieterwechsel). */
  mietverhaeltnisId: UUID;
  art: Zaehlerart;
  zaehlernummer?: string;
  standAnfang?: number;
  standEnde?: number;
  /** Direkt erfasster Verbrauch; falls gesetzt, hat er Vorrang vor Anfangs-/Endstand. */
  verbrauch?: number;
  einheit: Verbrauchseinheit;
}

/** Verbrauch, der auf Leerstand entfällt und daher vom Vermieter zu tragen ist. */
export interface Leerstandsverbrauch {
  id: UUID;
  abrechnungszeitraumId: UUID;
  einheitId: UUID;
  art: Zaehlerart;
  verbrauch: number;
  einheit: Verbrauchseinheit;
}

// ---------------------------------------------------------------------------
// Heizkosten (HeizkostenV)
// ---------------------------------------------------------------------------

/** Zulässige Verbrauchsanteile nach § 7 Abs. 1, § 8 Abs. 1 HeizkostenV. */
export type Verbrauchsanteil = 50 | 60 | 70;

export type WarmwasserErmittlung =
  /** Getrennte Anlagen: Heiz- und Warmwasserkosten werden separat erfasst. */
  | 'GETRENNT'
  /** Verbundene Anlage, Wärmemenge für Warmwasser wird gemessen (§ 9 Abs. 2 S. 1 HeizkostenV). */
  | 'WAERMEZAEHLER'
  /** Verbundene Anlage, Berechnung nach der Formel des § 9 Abs. 2 HeizkostenV. */
  | 'FORMEL_9_2'
  /** Verbundene Anlage, manuell vorgegebener Anteil (nur mit Begründung zulässig). */
  | 'MANUELL';

export interface HeizkostenEinstellungen {
  abrechnungszeitraumId: UUID;
  aktiv: boolean;
  /** Anteil der verbrauchsabhängigen Verteilung der Heizkosten (50–70 %, § 7 Abs. 1 HeizkostenV) */
  verbrauchsanteilHeizung: Verbrauchsanteil;
  /** Anteil der verbrauchsabhängigen Verteilung der Warmwasserkosten (§ 8 Abs. 1 HeizkostenV) */
  verbrauchsanteilWarmwasser: Verbrauchsanteil;
  warmwasserErmittlung: WarmwasserErmittlung;
  /** Bei WAERMEZAEHLER: gemessene Wärmemenge für die Warmwasserbereitung in kWh */
  waermemengeWarmwasserKwh?: number;
  /** Bei FORMEL_9_2: verbrauchtes Warmwasservolumen in m³ */
  warmwasserVolumenM3?: number;
  /** Bei FORMEL_9_2: mittlere Warmwassertemperatur in °C (Standard 60 °C) */
  warmwasserTemperaturC?: number;
  /** Gesamte von der Anlage erzeugte Wärmemenge in kWh (für den Anteilssatz erforderlich) */
  gesamtwaermemengeKwh?: number;
  /** Bei MANUELL: Warmwasseranteil an den Gesamtkosten in Prozent */
  warmwasserAnteilProzentManuell?: number;
  begruendungManuell?: string;
  /**
   * Es wurde verbrauchsabhängig abgerechnet. Andernfalls hat der Mieter nach
   * § 12 Abs. 1 HeizkostenV ein Kürzungsrecht von 15 %.
   */
  verbrauchsabhaengigAbgerechnet: boolean;
  /** Grund, falls nicht verbrauchsabhängig abgerechnet wurde */
  grundKeineVerbrauchserfassung?: string;
  /** Monatliche Verbrauchsinformation nach § 6a HeizkostenV wurde erteilt. */
  verbrauchsinformationErteilt?: boolean;
}

// ---------------------------------------------------------------------------
// Gesamtzustand
// ---------------------------------------------------------------------------

export interface AppState {
  version: number;
  objekt: Objekt;
  einheiten: Einheit[];
  mietverhaeltnisse: Mietverhaeltnis[];
  abrechnungszeitraeume: Abrechnungszeitraum[];
  kostenpositionen: Kostenposition[];
  verbraeuche: Verbrauch[];
  leerstandsverbraeuche: Leerstandsverbrauch[];
  heizkosten: HeizkostenEinstellungen[];
  aktiverZeitraumId?: UUID;
}
