/**
 * Rechenkern der Betriebskostenabrechnung.
 *
 * Die Abrechnung muss nach ständiger Rechtsprechung des BGH mindestens enthalten:
 *   1. eine Zusammenstellung der Gesamtkosten,
 *   2. die Angabe und Erläuterung des Verteilerschlüssels,
 *   3. die Berechnung des Anteils des Mieters,
 *   4. den Abzug der geleisteten Vorauszahlungen.
 *
 * Dieses Modul erzeugt genau diese Angaben je Mietverhältnis und trennt dabei
 * umlagefähige von nicht umlagefähigen Kosten.
 */

import { kostenartOderFallback, type Kostenart } from './katalog';
import { teileHeizkostenAuf, KUERZUNGSSATZ_HEIZKOSTENV, type HeizkostenAufteilung } from './heizkosten';
import type {
  Abrechnungszeitraum,
  AppState,
  Cent,
  Einheit,
  HeizkostenEinstellungen,
  ISODate,
  Kostenposition,
  Mietverhaeltnis,
  UUID,
  Verteilerschluessel,
  Zaehlerart,
} from './types';
import {
  angefangeneMonate,
  anteilVonBetrag,
  schnittmenge,
  summe,
  tageInZeitraum,
  ueberschneidungTage,
  verteileCent,
} from './util';

// ---------------------------------------------------------------------------
// Belegung des Abrechnungszeitraums
// ---------------------------------------------------------------------------

export interface Nutzungszeitraum {
  mietverhaeltnis: Mietverhaeltnis;
  einheit: Einheit;
  von: ISODate;
  bis: ISODate;
  tage: number;
  /** Summe aus Personenzahl × Tage im Abrechnungszeitraum */
  personentage: number;
  /** Durchschnittliche Personenzahl im Nutzungszeitraum */
  personenDurchschnitt: number;
}

/** Ermittelt alle Mietverhältnisse, die im Abrechnungszeitraum (teilweise) bestanden. */
export function ermittleNutzungszeitraeume(
  state: AppState,
  zeitraum: Abrechnungszeitraum,
): Nutzungszeitraum[] {
  const einheiten = new Map(state.einheiten.map((e) => [e.id, e]));
  const ergebnis: Nutzungszeitraum[] = [];

  for (const mv of state.mietverhaeltnisse) {
    const einheit = einheiten.get(mv.einheitId);
    if (!einheit || einheit.objektId !== zeitraum.objektId) continue;

    const mietzeit = { von: mv.beginn, bis: mv.ende ?? '9999-12-31' };
    const s = schnittmenge(mietzeit, { von: zeitraum.von, bis: zeitraum.bis });
    if (!s) continue;

    const tage = tageInZeitraum(s.von, s.bis);
    const personentage = summe(
      mv.personenzahlen.map((p) => p.anzahl * ueberschneidungTage(p, s)),
    );

    ergebnis.push({
      mietverhaeltnis: mv,
      einheit,
      von: s.von,
      bis: s.bis,
      tage,
      personentage,
      personenDurchschnitt: tage > 0 ? personentage / tage : 0,
    });
  }

  return ergebnis.sort(
    (a, b) => a.einheit.bezeichnung.localeCompare(b.einheit.bezeichnung, 'de') || a.von.localeCompare(b.von),
  );
}

// ---------------------------------------------------------------------------
// Umlagemaßstäbe
// ---------------------------------------------------------------------------

export interface BasisEintrag {
  /** Zeitgewichtetes Gewicht, nach dem verteilt wird */
  gewicht: number;
  /** Anschaulicher Maßstabswert (z. B. 72,5 m² oder 2,5 Personen) */
  massstabWert: number;
  tage: number;
}

export interface Umlagebasis {
  schluessel: Verteilerschluessel;
  /** Einheit des Maßstabswerts, z. B. "m²" */
  massstabEinheit: string;
  /** Der Maßstab wird nach Nutzungstagen gewichtet */
  zeitgewichtet: boolean;
  /** Summe aller Gewichte inklusive Leerstand */
  gesamtGewicht: number;
  /** Ungewichteter Gesamtmaßstab aller Einheiten (z. B. Gesamtwohnfläche) */
  gesamtMassstabWert: number;
  /** Auf Leerstand entfallendes Gewicht – der zugehörige Kostenanteil trägt der Vermieter */
  leerstandGewicht: number;
  eintraege: Record<UUID, BasisEintrag>;
  /** Fehlende Daten (z. B. nicht erfasste Zählerstände) */
  maengel: string[];
}

function verbrauchWert(
  state: AppState,
  zeitraumId: UUID,
  mietverhaeltnisId: UUID,
  art: Zaehlerart,
): number | undefined {
  const eintraege = state.verbraeuche.filter(
    (v) =>
      v.abrechnungszeitraumId === zeitraumId &&
      v.mietverhaeltnisId === mietverhaeltnisId &&
      v.art === art,
  );
  if (eintraege.length === 0) return undefined;
  return summe(
    eintraege.map((v) =>
      v.verbrauch !== undefined && v.verbrauch !== null
        ? v.verbrauch
        : (v.standEnde ?? 0) - (v.standAnfang ?? 0),
    ),
  );
}

const EINHEIT_BEZEICHNUNG: Record<string, string> = {
  m3: 'm³',
  kWh: 'kWh',
  Einheiten: 'Einheiten',
  'Stück': 'Stück',
};

/**
 * Bezeichnung des Verbrauchsmaßstabs. Bevorzugt wird die tatsächlich erfasste
 * Einheit; nur wenn diese uneinheitlich oder unbekannt ist, greift der Vorgabewert
 * der Zählerart.
 */
function verbrauchsEinheitBezeichnung(
  state: AppState,
  zeitraumId: UUID,
  art: Zaehlerart,
): string {
  const einheiten = new Set(
    state.verbraeuche
      .filter((v) => v.abrechnungszeitraumId === zeitraumId && v.art === art)
      .map((v) => v.einheit),
  );
  if (einheiten.size === 1) {
    const [einzige] = [...einheiten];
    return EINHEIT_BEZEICHNUNG[einzige] ?? einzige;
  }
  return art === 'KALTWASSER' || art === 'WARMWASSER' ? 'm³' : 'Einheiten';
}

function leerstandsVerbrauchWert(state: AppState, zeitraumId: UUID, art: Zaehlerart): number {
  return summe(
    state.leerstandsverbraeuche
      .filter((v) => v.abrechnungszeitraumId === zeitraumId && v.art === art)
      .map((v) => v.verbrauch),
  );
}

/**
 * Baut den Umlagemaßstab für einen Verteilerschlüssel auf. Die Bezugsgröße wird
 * für den gesamten Abrechnungszeitraum und für alle Einheiten des Objekts
 * gebildet; Leerstandsanteile verbleiben dadurch beim Vermieter.
 */
export function baueUmlagebasis(
  state: AppState,
  zeitraum: Abrechnungszeitraum,
  nutzungen: Nutzungszeitraum[],
  schluessel: Verteilerschluessel,
  optionen: { verbrauchsart?: Zaehlerart; direktEinheitId?: UUID } = {},
): Umlagebasis {
  const gesamtTage = tageInZeitraum(zeitraum.von, zeitraum.bis);
  const einheiten = state.einheiten.filter((e) => e.objektId === zeitraum.objektId);
  const eintraege: Record<UUID, BasisEintrag> = {};
  const maengel: string[] = [];

  const relevanteEinheiten =
    schluessel === 'DIREKTZUORDNUNG'
      ? einheiten.filter((e) => e.id === optionen.direktEinheitId)
      : einheiten;
  const relevanteNutzungen =
    schluessel === 'DIREKTZUORDNUNG'
      ? nutzungen.filter((n) => n.einheit.id === optionen.direktEinheitId)
      : nutzungen;

  const belegteTage = (einheitId: UUID) =>
    summe(relevanteNutzungen.filter((n) => n.einheit.id === einheitId).map((n) => n.tage));

  let gesamtGewicht = 0;
  let gesamtMassstabWert = 0;
  let leerstandGewicht = 0;
  let massstabEinheit = '';
  let zeitgewichtet = true;

  switch (schluessel) {
    case 'WOHNFLAECHE': {
      massstabEinheit = 'm²';
      for (const n of relevanteNutzungen) {
        eintraege[n.mietverhaeltnis.id] = {
          gewicht: n.einheit.wohnflaecheQm * n.tage,
          massstabWert: n.einheit.wohnflaecheQm,
          tage: n.tage,
        };
      }
      for (const e of relevanteEinheiten) {
        gesamtMassstabWert += e.wohnflaecheQm;
        gesamtGewicht += e.wohnflaecheQm * gesamtTage;
        leerstandGewicht += e.wohnflaecheQm * (gesamtTage - belegteTage(e.id));
      }
      break;
    }

    case 'WOHNEINHEIT': {
      massstabEinheit = 'Einheit(en)';
      for (const n of relevanteNutzungen) {
        eintraege[n.mietverhaeltnis.id] = { gewicht: n.tage, massstabWert: 1, tage: n.tage };
      }
      for (const e of relevanteEinheiten) {
        gesamtMassstabWert += 1;
        gesamtGewicht += gesamtTage;
        leerstandGewicht += gesamtTage - belegteTage(e.id);
      }
      break;
    }

    case 'DIREKTZUORDNUNG': {
      massstabEinheit = 'Nutzungstage';
      for (const n of relevanteNutzungen) {
        eintraege[n.mietverhaeltnis.id] = { gewicht: n.tage, massstabWert: n.tage, tage: n.tage };
      }
      for (const e of relevanteEinheiten) {
        gesamtMassstabWert += gesamtTage;
        gesamtGewicht += gesamtTage;
        leerstandGewicht += gesamtTage - belegteTage(e.id);
      }
      if (relevanteEinheiten.length === 0) {
        maengel.push('Der Position ist keine gültige Einheit zugeordnet.');
      }
      break;
    }

    case 'MITEIGENTUMSANTEIL': {
      massstabEinheit = 'MEA';
      for (const n of relevanteNutzungen) {
        const mea = n.einheit.miteigentumsanteil ?? 0;
        if (mea <= 0) {
          maengel.push(`Für "${n.einheit.bezeichnung}" ist kein Miteigentumsanteil hinterlegt.`);
        }
        eintraege[n.mietverhaeltnis.id] = { gewicht: mea * n.tage, massstabWert: mea, tage: n.tage };
      }
      for (const e of relevanteEinheiten) {
        const mea = e.miteigentumsanteil ?? 0;
        gesamtMassstabWert += mea;
        gesamtGewicht += mea * gesamtTage;
        leerstandGewicht += mea * (gesamtTage - belegteTage(e.id));
      }
      break;
    }

    case 'PERSONENZAHL': {
      massstabEinheit = 'Personen';
      const fiktiv = state.objekt.leerstandPersonenFiktiv ?? 0;
      for (const n of relevanteNutzungen) {
        if (n.personentage <= 0) {
          maengel.push(
            `Für "${n.mietverhaeltnis.mieter.join(', ')}" ist keine Personenzahl erfasst.`,
          );
        }
        eintraege[n.mietverhaeltnis.id] = {
          gewicht: n.personentage,
          massstabWert: n.personenDurchschnitt,
          tage: n.tage,
        };
        gesamtGewicht += n.personentage;
      }
      for (const e of relevanteEinheiten) {
        const leerTage = gesamtTage - belegteTage(e.id);
        leerstandGewicht += leerTage * fiktiv;
        gesamtGewicht += leerTage * fiktiv;
      }
      gesamtMassstabWert = gesamtTage > 0 ? gesamtGewicht / gesamtTage : 0;
      break;
    }

    case 'VERBRAUCH':
    case 'HEIZKOSTENV': {
      zeitgewichtet = false;
      const art = optionen.verbrauchsart ?? 'HEIZUNG';
      massstabEinheit = verbrauchsEinheitBezeichnung(state, zeitraum.id, art);
      for (const n of relevanteNutzungen) {
        const wert = verbrauchWert(state, zeitraum.id, n.mietverhaeltnis.id, art);
        if (wert === undefined) {
          maengel.push(
            `Kein Verbrauchswert (${art}) für "${n.mietverhaeltnis.mieter.join(', ')}" erfasst.`,
          );
        }
        const v = Math.max(wert ?? 0, 0);
        eintraege[n.mietverhaeltnis.id] = { gewicht: v, massstabWert: v, tage: n.tage };
        gesamtGewicht += v;
      }
      const leerVerbrauch = leerstandsVerbrauchWert(state, zeitraum.id, art);
      leerstandGewicht = leerVerbrauch;
      gesamtGewicht += leerVerbrauch;
      gesamtMassstabWert = gesamtGewicht;
      break;
    }
  }

  return {
    schluessel,
    massstabEinheit,
    zeitgewichtet,
    gesamtGewicht,
    gesamtMassstabWert,
    leerstandGewicht,
    eintraege,
    maengel,
  };
}

// ---------------------------------------------------------------------------
// Verteilung einzelner Kostenpositionen
// ---------------------------------------------------------------------------

export interface Verteilung {
  anteile: Record<UUID, Cent>;
  leerstandsanteil: Cent;
}

/**
 * Verteilt einen Betrag verlustfrei auf die Mietverhältnisse. Der auf Leerstand
 * entfallende Rest wird gesondert ausgewiesen und vom Vermieter getragen.
 */
export function verteileNachBasis(betrag: Cent, basis: Umlagebasis): Verteilung {
  const ids = Object.keys(basis.eintraege);
  const gewichte = ids.map((id) => basis.eintraege[id].gewicht);
  const alleGewichte = [...gewichte, Math.max(basis.leerstandGewicht, 0)];
  const verteilt = verteileCent(betrag, alleGewichte);

  const anteile: Record<UUID, Cent> = {};
  ids.forEach((id, i) => {
    anteile[id] = verteilt[i];
  });
  return { anteile, leerstandsanteil: verteilt[verteilt.length - 1] ?? 0 };
}

export interface PositionsVerteilung {
  position: Kostenposition;
  kostenart: Kostenart;
  /** Rechnungsbetrag insgesamt */
  gesamtbetrag: Cent;
  /** Vorwegabzug nicht umlagefähiger Bestandteile */
  vorwegabzug: Cent;
  /** Verbleibender umlagefähiger Betrag */
  umlagefaehigerBetrag: Cent;
  basis: Umlagebasis;
  anteile: Record<UUID, Cent>;
  leerstandsanteil: Cent;
}

// ---------------------------------------------------------------------------
// Heizkosten nach HeizkostenV
// ---------------------------------------------------------------------------

export interface HeizkostenBlock {
  id: string;
  bezeichnung: string;
  rechtsgrundlage: string;
  betrag: Cent;
  basis: Umlagebasis;
  anteile: Record<UUID, Cent>;
  leerstandsanteil: Cent;
}

export interface HeizkostenVerteilung {
  positionen: Kostenposition[];
  aufteilung: HeizkostenAufteilung;
  bloecke: HeizkostenBlock[];
  /** Kürzungsbetrag nach § 12 Abs. 1 HeizkostenV je Mietverhältnis (positiver Betrag = Abzug) */
  kuerzung: Record<UUID, Cent>;
  kuerzungAngewendet: boolean;
  einstellungen: HeizkostenEinstellungen;
}

function verteileHeizkosten(
  state: AppState,
  zeitraum: Abrechnungszeitraum,
  nutzungen: Nutzungszeitraum[],
  positionen: Kostenposition[],
  einstellungen: HeizkostenEinstellungen,
): HeizkostenVerteilung {
  const gesamt = summe(positionen.map(umlagefaehigerBetragDerPosition));
  const aufteilung = teileHeizkostenAuf(gesamt, einstellungen);
  const bloecke: HeizkostenBlock[] = [];

  const flaechenbasis = baueUmlagebasis(state, zeitraum, nutzungen, 'WOHNFLAECHE');

  if (!einstellungen.verbrauchsabhaengigAbgerechnet) {
    // § 12 Abs. 1 HeizkostenV: keine verbrauchsabhängige Abrechnung möglich.
    // Verteilung vollständig nach Fläche, dem Mieter steht ein Kürzungsrecht zu.
    const v = verteileNachBasis(gesamt, flaechenbasis);
    bloecke.push({
      id: 'HK_OHNE_VERBRAUCH',
      bezeichnung: 'Heiz- und Warmwasserkosten (ohne Verbrauchserfassung)',
      rechtsgrundlage: '§ 7 Abs. 1 HeizkostenV i. V. m. § 12 Abs. 1 HeizkostenV',
      betrag: gesamt,
      basis: flaechenbasis,
      anteile: v.anteile,
      leerstandsanteil: v.leerstandsanteil,
    });
    const kuerzung: Record<UUID, Cent> = {};
    for (const [id, betrag] of Object.entries(v.anteile)) {
      kuerzung[id] = anteilVonBetrag(betrag, KUERZUNGSSATZ_HEIZKOSTENV);
    }
    return { positionen, aufteilung, bloecke, kuerzung, kuerzungAngewendet: true, einstellungen };
  }

  const heizVerbrauchsbasis = baueUmlagebasis(state, zeitraum, nutzungen, 'VERBRAUCH', {
    verbrauchsart: 'HEIZUNG',
  });

  const heizGrund = verteileNachBasis(aufteilung.heizungGrundkosten, flaechenbasis);
  bloecke.push({
    id: 'HK_HEIZ_GRUND',
    bezeichnung: `Heizkosten – Grundkosten (${100 - einstellungen.verbrauchsanteilHeizung} %)`,
    rechtsgrundlage: '§ 7 Abs. 1 S. 1 HeizkostenV (Verteilung nach Wohnfläche)',
    betrag: aufteilung.heizungGrundkosten,
    basis: flaechenbasis,
    anteile: heizGrund.anteile,
    leerstandsanteil: heizGrund.leerstandsanteil,
  });

  const heizVerbrauch = verteileNachBasis(aufteilung.heizungVerbrauchskosten, heizVerbrauchsbasis);
  bloecke.push({
    id: 'HK_HEIZ_VERBRAUCH',
    bezeichnung: `Heizkosten – Verbrauchskosten (${einstellungen.verbrauchsanteilHeizung} %)`,
    rechtsgrundlage: '§ 7 Abs. 1 S. 1 HeizkostenV (Verteilung nach erfasstem Verbrauch)',
    betrag: aufteilung.heizungVerbrauchskosten,
    basis: heizVerbrauchsbasis,
    anteile: heizVerbrauch.anteile,
    leerstandsanteil: heizVerbrauch.leerstandsanteil,
  });

  if (aufteilung.warmwasserKosten > 0) {
    const wwVerbrauchsbasis = baueUmlagebasis(state, zeitraum, nutzungen, 'VERBRAUCH', {
      verbrauchsart: 'WARMWASSER',
    });

    const wwGrund = verteileNachBasis(aufteilung.warmwasserGrundkosten, flaechenbasis);
    bloecke.push({
      id: 'HK_WW_GRUND',
      bezeichnung: `Warmwasserkosten – Grundkosten (${100 - einstellungen.verbrauchsanteilWarmwasser} %)`,
      rechtsgrundlage: '§ 8 Abs. 1 HeizkostenV (Verteilung nach Wohnfläche)',
      betrag: aufteilung.warmwasserGrundkosten,
      basis: flaechenbasis,
      anteile: wwGrund.anteile,
      leerstandsanteil: wwGrund.leerstandsanteil,
    });

    const wwVerbrauch = verteileNachBasis(aufteilung.warmwasserVerbrauchskosten, wwVerbrauchsbasis);
    bloecke.push({
      id: 'HK_WW_VERBRAUCH',
      bezeichnung: `Warmwasserkosten – Verbrauchskosten (${einstellungen.verbrauchsanteilWarmwasser} %)`,
      rechtsgrundlage: '§ 8 Abs. 1 HeizkostenV (Verteilung nach erfasstem Verbrauch)',
      betrag: aufteilung.warmwasserVerbrauchskosten,
      basis: wwVerbrauchsbasis,
      anteile: wwVerbrauch.anteile,
      leerstandsanteil: wwVerbrauch.leerstandsanteil,
    });
  }

  return { positionen, aufteilung, bloecke, kuerzung: {}, kuerzungAngewendet: false, einstellungen };
}

// ---------------------------------------------------------------------------
// Gesamtabrechnung
// ---------------------------------------------------------------------------

export function umlagefaehigerBetragDerPosition(p: Kostenposition): Cent {
  const art = kostenartOderFallback(p.katalogId);
  if (!art.umlagefaehig) return 0;
  return Math.max(p.betrag - (p.nichtUmlagefaehigerAnteil ?? 0), 0);
}

export interface Abrechnungszeile {
  id: string;
  bezeichnung: string;
  fundstelle: string;
  /** Umlagefähige Gesamtkosten der Position im Objekt */
  gesamtkosten: Cent;
  schluessel: Verteilerschluessel;
  schluesselErlaeuterung: string;
  massstabEinheit: string;
  mieterMassstab: number;
  gesamtMassstab: number;
  /** Zeitanteilige Berücksichtigung */
  tage: number;
  gesamtTage: number;
  zeitgewichtet: boolean;
  anteil: Cent;
  gruppe: 'KALT' | 'HEIZUNG';
}

export interface MieterAbrechnung {
  nutzung: Nutzungszeitraum;
  zeilen: Abrechnungszeile[];
  summeKalteBetriebskosten: Cent;
  summeHeizUndWarmwasser: Cent;
  /** Kürzung nach § 12 Abs. 1 HeizkostenV (positiver Betrag = Abzug zugunsten des Mieters) */
  kuerzungHeizkostenV: Cent;
  summeUmlagefaehig: Cent;
  vorauszahlungen: Cent;
  vorauszahlungenGeschaetzt: boolean;
  /** Positiver Saldo = Nachzahlung, negativer Saldo = Guthaben */
  saldo: Cent;
  /** Anteilige Arbeitskosten für die Bescheinigung nach § 35a EStG */
  arbeitskosten35a: Cent;
  hinweise: string[];
}

export interface Abrechnungsergebnis {
  zeitraum: Abrechnungszeitraum;
  gesamtTage: number;
  nutzungen: Nutzungszeitraum[];
  positionsVerteilungen: PositionsVerteilung[];
  heizkosten?: HeizkostenVerteilung;
  /** Alle im Zeitraum erfassten nicht umlagefähigen Positionen */
  nichtUmlagefaehigePositionen: Kostenposition[];
  gesamtkostenAlle: Cent;
  gesamtkostenUmlagefaehig: Cent;
  gesamtkostenNichtUmlagefaehig: Cent;
  /** Summe der Vorwegabzüge aus umlagefähigen Positionen */
  vorwegabzuegeGesamt: Cent;
  /** Von den umlagefähigen Kosten auf Leerstand entfallender und daher vom Vermieter getragener Anteil */
  leerstandsanteilVermieter: Cent;
  mieterAbrechnungen: MieterAbrechnung[];
}

function erlaeuterung(basis: Umlagebasis, einstellungen?: HeizkostenEinstellungen): string {
  switch (basis.schluessel) {
    case 'WOHNFLAECHE':
      return 'Umlage nach dem Anteil der Wohnfläche an der Gesamtwohnfläche (§ 556a Abs. 1 S. 1 BGB).';
    case 'PERSONENZAHL':
      return 'Umlage nach Personenzahl; unterjährige Änderungen werden über Personentage berücksichtigt.';
    case 'WOHNEINHEIT':
      return 'Umlage zu gleichen Teilen auf alle Wohneinheiten des Objekts.';
    case 'MITEIGENTUMSANTEIL':
      return 'Umlage nach den Miteigentumsanteilen der Einheiten.';
    case 'VERBRAUCH':
      return 'Umlage nach dem erfassten Verbrauch (§ 556a Abs. 1 S. 2 BGB).';
    case 'DIREKTZUORDNUNG':
      return 'Die Kosten sind ausschließlich für diese Einheit angefallen und werden ihr direkt zugeordnet.';
    case 'HEIZKOSTENV':
      return einstellungen
        ? `Verteilung nach HeizkostenV: ${einstellungen.verbrauchsanteilHeizung} % nach Verbrauch, ${100 - einstellungen.verbrauchsanteilHeizung} % nach Wohnfläche.`
        : 'Verteilung nach HeizkostenV.';
  }
}

export function berechneAbrechnung(
  state: AppState,
  zeitraum: Abrechnungszeitraum,
): Abrechnungsergebnis {
  const gesamtTage = tageInZeitraum(zeitraum.von, zeitraum.bis);
  const nutzungen = ermittleNutzungszeitraeume(state, zeitraum);
  const positionen = state.kostenpositionen.filter((p) => p.abrechnungszeitraumId === zeitraum.id);

  const heizPositionen = positionen.filter(
    (p) => p.verteilerschluessel === 'HEIZKOSTENV' && kostenartOderFallback(p.katalogId).umlagefaehig,
  );
  const umlagePositionen = positionen.filter(
    (p) => p.verteilerschluessel !== 'HEIZKOSTENV' && kostenartOderFallback(p.katalogId).umlagefaehig,
  );
  const nichtUmlagefaehigePositionen = positionen.filter(
    (p) => !kostenartOderFallback(p.katalogId).umlagefaehig,
  );

  // --- kalte Betriebskosten -------------------------------------------------
  const positionsVerteilungen: PositionsVerteilung[] = umlagePositionen.map((p) => {
    const kostenart = kostenartOderFallback(p.katalogId);
    const basis = baueUmlagebasis(state, zeitraum, nutzungen, p.verteilerschluessel, {
      verbrauchsart: p.verbrauchsart ?? kostenart.verbrauchsart,
      direktEinheitId: p.direktEinheitId,
    });
    const umlagefaehigerBetrag = umlagefaehigerBetragDerPosition(p);
    const v = verteileNachBasis(umlagefaehigerBetrag, basis);
    return {
      position: p,
      kostenart,
      gesamtbetrag: p.betrag,
      vorwegabzug: p.nichtUmlagefaehigerAnteil ?? 0,
      umlagefaehigerBetrag,
      basis,
      anteile: v.anteile,
      leerstandsanteil: v.leerstandsanteil,
    };
  });

  // --- Heiz- und Warmwasserkosten ------------------------------------------
  const einstellungen = state.heizkosten.find((h) => h.abrechnungszeitraumId === zeitraum.id);
  const heizkosten =
    heizPositionen.length > 0 && einstellungen?.aktiv
      ? verteileHeizkosten(state, zeitraum, nutzungen, heizPositionen, einstellungen)
      : undefined;

  // --- je Mietverhältnis ----------------------------------------------------
  const mieterAbrechnungen: MieterAbrechnung[] = nutzungen.map((n) => {
    const mvId = n.mietverhaeltnis.id;
    const zeilen: Abrechnungszeile[] = [];
    const hinweise: string[] = [];
    let arbeitskosten35a = 0;

    for (const pv of positionsVerteilungen) {
      const eintrag = pv.basis.eintraege[mvId];
      const anteil = pv.anteile[mvId] ?? 0;
      if (!eintrag && anteil === 0) continue;
      zeilen.push({
        id: pv.position.id,
        bezeichnung: pv.position.bezeichnung,
        fundstelle: pv.kostenart.fundstelle,
        gesamtkosten: pv.umlagefaehigerBetrag,
        schluessel: pv.basis.schluessel,
        schluesselErlaeuterung: erlaeuterung(pv.basis),
        massstabEinheit: pv.basis.massstabEinheit,
        mieterMassstab: eintrag?.massstabWert ?? 0,
        gesamtMassstab: pv.basis.gesamtMassstabWert,
        tage: eintrag?.tage ?? 0,
        gesamtTage,
        zeitgewichtet: pv.basis.zeitgewichtet,
        anteil,
        gruppe: 'KALT',
      });
      if (pv.position.arbeitskostenAnteil && pv.umlagefaehigerBetrag > 0) {
        arbeitskosten35a += Math.round(
          (pv.position.arbeitskostenAnteil * anteil) / pv.umlagefaehigerBetrag,
        );
      }
    }

    if (heizkosten) {
      for (const block of heizkosten.bloecke) {
        const eintrag = block.basis.eintraege[mvId];
        const anteil = block.anteile[mvId] ?? 0;
        if (!eintrag && anteil === 0) continue;
        zeilen.push({
          id: block.id,
          bezeichnung: block.bezeichnung,
          fundstelle: block.rechtsgrundlage,
          gesamtkosten: block.betrag,
          schluessel: block.basis.schluessel,
          schluesselErlaeuterung: erlaeuterung(block.basis, heizkosten.einstellungen),
          massstabEinheit: block.basis.massstabEinheit,
          mieterMassstab: eintrag?.massstabWert ?? 0,
          gesamtMassstab: block.basis.gesamtMassstabWert,
          tage: eintrag?.tage ?? n.tage,
          gesamtTage,
          zeitgewichtet: block.basis.zeitgewichtet,
          anteil,
          gruppe: 'HEIZUNG',
        });
      }
      const anteilHeiz = summe(
        heizkosten.positionen.map(
          (p) => p.arbeitskostenAnteil ?? 0,
        ),
      );
      const gesamtHeiz = heizkosten.aufteilung.gesamt;
      if (anteilHeiz > 0 && gesamtHeiz > 0) {
        const mieterHeizsumme = summe(heizkosten.bloecke.map((b) => b.anteile[mvId] ?? 0));
        arbeitskosten35a += Math.round((anteilHeiz * mieterHeizsumme) / gesamtHeiz);
      }
    }

    const summeKalteBetriebskosten = summe(
      zeilen.filter((z) => z.gruppe === 'KALT').map((z) => z.anteil),
    );
    const summeHeizUndWarmwasser = summe(
      zeilen.filter((z) => z.gruppe === 'HEIZUNG').map((z) => z.anteil),
    );
    const kuerzungHeizkostenV = heizkosten?.kuerzung[mvId] ?? 0;
    const summeUmlagefaehig =
      summeKalteBetriebskosten + summeHeizUndWarmwasser - kuerzungHeizkostenV;

    const tatsaechlich = n.mietverhaeltnis.vorauszahlungenTatsaechlich?.[zeitraum.id];
    const monate = angefangeneMonate(n.von, n.bis);
    const berechneteVorauszahlung =
      (n.mietverhaeltnis.vorauszahlungBetriebskostenMonatlich +
        n.mietverhaeltnis.vorauszahlungHeizkostenMonatlich) *
      monate;
    const vorauszahlungen = tatsaechlich ?? berechneteVorauszahlung;

    if (tatsaechlich === undefined) {
      hinweise.push(
        `Die Vorauszahlungen wurden rechnerisch aus ${monate} Monat(en) × monatlicher Vorauszahlung ermittelt. Abweichende tatsächliche Zahlungen bitte erfassen.`,
      );
    }
    if (n.tage < gesamtTage) {
      hinweise.push(
        `Das Mietverhältnis bestand nur vom ${n.von} bis ${n.bis} (${n.tage} von ${gesamtTage} Tagen); zeitabhängige Kosten wurden anteilig berücksichtigt.`,
      );
    }
    if (kuerzungHeizkostenV > 0) {
      hinweise.push(
        'Da die Heiz- und Warmwasserkosten nicht verbrauchsabhängig abgerechnet wurden, ist der Anteil nach § 12 Abs. 1 HeizkostenV um 15 % gekürzt worden.',
      );
    }

    return {
      nutzung: n,
      zeilen,
      summeKalteBetriebskosten,
      summeHeizUndWarmwasser,
      kuerzungHeizkostenV,
      summeUmlagefaehig,
      vorauszahlungen,
      vorauszahlungenGeschaetzt: tatsaechlich === undefined,
      saldo: summeUmlagefaehig - vorauszahlungen,
      arbeitskosten35a,
      hinweise,
    };
  });

  const gesamtkostenUmlagefaehig =
    summe(positionsVerteilungen.map((p) => p.umlagefaehigerBetrag)) +
    (heizkosten?.aufteilung.gesamt ?? 0);
  // Vorwegabzüge zählen nur bei umlagefähigen Kostenarten; bei nicht umlagefähigen
  // Positionen ist bereits der volle Betrag nicht umlagefähig.
  const vorwegabzuegeGesamt = summe(
    [...umlagePositionen, ...heizPositionen].map((p) => p.nichtUmlagefaehigerAnteil ?? 0),
  );
  const gesamtkostenNichtUmlagefaehig =
    summe(nichtUmlagefaehigePositionen.map((p) => p.betrag)) + vorwegabzuegeGesamt;

  const leerstandKalt = summe(positionsVerteilungen.map((p) => p.leerstandsanteil));
  const leerstandHeiz = summe(heizkosten?.bloecke.map((b) => b.leerstandsanteil) ?? []);

  return {
    zeitraum,
    gesamtTage,
    nutzungen,
    positionsVerteilungen,
    heizkosten,
    nichtUmlagefaehigePositionen,
    gesamtkostenAlle: summe(positionen.map((p) => p.betrag)),
    gesamtkostenUmlagefaehig,
    gesamtkostenNichtUmlagefaehig,
    vorwegabzuegeGesamt,
    leerstandsanteilVermieter: leerstandKalt + leerstandHeiz,
    mieterAbrechnungen,
  };
}
