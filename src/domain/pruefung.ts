/**
 * Formelle und materielle Prüfung der Abrechnung.
 *
 * Geprüft werden insbesondere:
 *  - § 556 Abs. 2, 3 BGB   Abrechnungszeitraum, Abrechnungsfrist, Pauschale
 *  - § 556 Abs. 1 BGB      wirksame Umlagevereinbarung
 *  - § 556a BGB            Abrechnungsmaßstab
 *  - § 2 BetrKV            abschließender Katalog umlagefähiger Kosten
 *  - § 1 Abs. 2 BetrKV     Verwaltungs- und Instandhaltungskosten
 *  - §§ 7–9, 12 HeizkostenV Verteilung der Heiz- und Warmwasserkosten
 *  - § 230 Abs. 5 TKG      Wegfall des Nebenkostenprivilegs zum 30.06.2024
 */

import type { Abrechnungsergebnis } from './berechnung';
import { kostenartOderFallback } from './katalog';
import { ermittleWarmwasserAnteil } from './heizkosten';
import type { AppState, Abrechnungszeitraum } from './types';
import {
  addMonate,
  addTage,
  formatDatum,
  formatEuro,
  heuteISO,
  summe,
  tageInZeitraum,
} from './util';

export type Schweregrad = 'FEHLER' | 'WARNUNG' | 'HINWEIS';

export interface Befund {
  schweregrad: Schweregrad;
  titel: string;
  beschreibung: string;
  rechtsgrundlage?: string;
  /** Verweis auf den Bereich der Oberfläche, in dem die Ursache behoben wird */
  bereich?: string;
}

const FEHLER = (
  titel: string,
  beschreibung: string,
  rechtsgrundlage?: string,
  bereich?: string,
): Befund => ({ schweregrad: 'FEHLER', titel, beschreibung, rechtsgrundlage, bereich });
const WARNUNG = (
  titel: string,
  beschreibung: string,
  rechtsgrundlage?: string,
  bereich?: string,
): Befund => ({ schweregrad: 'WARNUNG', titel, beschreibung, rechtsgrundlage, bereich });
const HINWEIS = (
  titel: string,
  beschreibung: string,
  rechtsgrundlage?: string,
  bereich?: string,
): Befund => ({ schweregrad: 'HINWEIS', titel, beschreibung, rechtsgrundlage, bereich });

export interface Pruefbericht {
  befunde: Befund[];
  anzahlFehler: number;
  anzahlWarnungen: number;
  /** Abrechnung kann formal erteilt werden (keine Fehler) */
  erteilbar: boolean;
  /** Ende der Abrechnungsfrist nach § 556 Abs. 3 S. 2 BGB */
  abrechnungsfristEnde: string;
  abrechnungsfristAbgelaufen: boolean;
}

export function pruefeAbrechnung(
  state: AppState,
  zeitraum: Abrechnungszeitraum,
  ergebnis: Abrechnungsergebnis,
): Pruefbericht {
  const befunde: Befund[] = [];
  const gesamtTage = tageInZeitraum(zeitraum.von, zeitraum.bis);
  const fristEnde = addTage(addMonate(zeitraum.bis, 12), 0);
  const stichtag = zeitraum.zugangDatum ?? heuteISO();
  const fristAbgelaufen = stichtag > fristEnde;

  // --- Stammdaten -----------------------------------------------------------
  const v = state.objekt.vermieter;
  if (!v.name?.trim() || !v.strasse?.trim() || !v.ort?.trim()) {
    befunde.push(
      FEHLER(
        'Angaben zum Vermieter unvollständig',
        'Die Abrechnung muss den Vermieter mit Name und ladungsfähiger Anschrift ausweisen, damit sie dem Mieter zurechenbar und die Zahlungsaufforderung wirksam ist.',
        '§ 259 BGB',
        'Objekt & Vermieter',
      ),
    );
  }
  if (!state.objekt.strasse?.trim() || !state.objekt.ort?.trim()) {
    befunde.push(
      FEHLER(
        'Anschrift des Objekts fehlt',
        'Die Abrechnung muss das abgerechnete Objekt eindeutig bezeichnen.',
        undefined,
        'Objekt & Vermieter',
      ),
    );
  }

  const einheiten = state.einheiten.filter((e) => e.objektId === zeitraum.objektId);
  if (einheiten.length === 0) {
    befunde.push(
      FEHLER('Keine Einheiten erfasst', 'Ohne Einheiten kann kein Umlagemaßstab gebildet werden.', undefined, 'Einheiten'),
    );
  }
  for (const e of einheiten) {
    if (!(e.wohnflaecheQm > 0)) {
      befunde.push(
        FEHLER(
          `Wohnfläche fehlt: ${e.bezeichnung}`,
          'Die Wohnfläche ist Grundlage des gesetzlichen Regelmaßstabs und muss für jede Einheit erfasst sein.',
          '§ 556a Abs. 1 S. 1 BGB',
          'Einheiten',
        ),
      );
    }
  }

  // --- Abrechnungszeitraum --------------------------------------------------
  if (zeitraum.von > zeitraum.bis) {
    befunde.push(
      FEHLER('Abrechnungszeitraum ungültig', 'Das Startdatum liegt nach dem Enddatum.', undefined, 'Abrechnungszeitraum'),
    );
  } else if (gesamtTage > 366) {
    befunde.push(
      FEHLER(
        'Abrechnungszeitraum länger als zwölf Monate',
        `Der Zeitraum umfasst ${gesamtTage} Tage. Über Betriebskosten ist jährlich abzurechnen; ein längerer Abrechnungszeitraum ist unzulässig.`,
        '§ 556 Abs. 3 S. 1 BGB',
        'Abrechnungszeitraum',
      ),
    );
  } else if (gesamtTage < 360) {
    befunde.push(
      HINWEIS(
        'Verkürzter Abrechnungszeitraum',
        `Der Zeitraum umfasst nur ${gesamtTage} Tage. Ein kürzerer Zeitraum ist zulässig (z. B. bei Umstellung), muss aber sachlich begründet sein.`,
        '§ 556 Abs. 3 S. 1 BGB',
        'Abrechnungszeitraum',
      ),
    );
  }

  if (fristAbgelaufen) {
    befunde.push(
      WARNUNG(
        'Abrechnungsfrist abgelaufen',
        `Die Abrechnung muss dem Mieter spätestens bis zum ${formatDatum(fristEnde)} zugehen. ` +
          `Nach Ablauf sind Nachforderungen ausgeschlossen, sofern der Vermieter die Verspätung zu vertreten hat. ` +
          `Ein Guthaben ist dem Mieter gleichwohl auszuzahlen.`,
        '§ 556 Abs. 3 S. 2, 3 BGB',
        'Abrechnungszeitraum',
      ),
    );
  }

  // --- Mietverhältnisse -----------------------------------------------------
  if (ergebnis.nutzungen.length === 0) {
    befunde.push(
      FEHLER(
        'Kein Mietverhältnis im Abrechnungszeitraum',
        'Im gewählten Zeitraum besteht kein Mietverhältnis, für das abgerechnet werden könnte.',
        undefined,
        'Mietverhältnisse',
      ),
    );
  }
  for (const n of ergebnis.nutzungen) {
    const mv = n.mietverhaeltnis;
    const name = mv.mieter.join(', ') || '(ohne Namen)';
    if (mv.mieter.length === 0 || mv.mieter.every((m) => !m.trim())) {
      befunde.push(
        FEHLER(
          'Mietername fehlt',
          `Für die Einheit "${n.einheit.bezeichnung}" ist kein Mieter erfasst. Die Abrechnung muss an sämtliche Mieter des Mietvertrages gerichtet sein.`,
          undefined,
          'Mietverhältnisse',
        ),
      );
    }
    if (!mv.umlageVereinbart) {
      befunde.push(
        FEHLER(
          `Keine Umlagevereinbarung: ${name}`,
          'Betriebskosten darf der Vermieter nur umlegen, wenn dies im Mietvertrag vereinbart ist. Ohne Vereinbarung sind sie mit der Grundmiete abgegolten.',
          '§ 556 Abs. 1 BGB',
          'Mietverhältnisse',
        ),
      );
    }
    if (mv.betriebskostenpauschale) {
      befunde.push(
        WARNUNG(
          `Betriebskostenpauschale vereinbart: ${name}`,
          'Bei einer Pauschale ist keine Abrechnung geschuldet; Nachforderungen sind ausgeschlossen. Prüfen Sie, ob für dieses Mietverhältnis überhaupt abgerechnet werden darf.',
          '§ 556 Abs. 2 BGB',
          'Mietverhältnisse',
        ),
      );
    }
    if (
      mv.vorauszahlungBetriebskostenMonatlich === 0 &&
      mv.vorauszahlungHeizkostenMonatlich === 0 &&
      mv.vorauszahlungenTatsaechlich?.[zeitraum.id] === undefined
    ) {
      befunde.push(
        WARNUNG(
          `Keine Vorauszahlungen erfasst: ${name}`,
          'Ohne erfasste Vorauszahlungen wird der gesamte Kostenanteil als Nachzahlung ausgewiesen. Der Abzug der Vorauszahlungen gehört zum notwendigen Inhalt der Abrechnung.',
          '§ 556 Abs. 3 S. 1 BGB',
          'Mietverhältnisse',
        ),
      );
    }
  }

  // --- Kostenpositionen -----------------------------------------------------
  const positionen = state.kostenpositionen.filter((p) => p.abrechnungszeitraumId === zeitraum.id);
  if (positionen.length === 0) {
    befunde.push(
      FEHLER('Keine Kosten erfasst', 'Für den Abrechnungszeitraum wurden keine Kostenpositionen erfasst.', undefined, 'Kosten'),
    );
  }

  const sonstigeOhneVereinbarung = positionen.filter((p) => p.katalogId === 'BETRKV_2_17');
  if (sonstigeOhneVereinbarung.length > 0) {
    const betroffene = ergebnis.nutzungen.filter(
      (n) => !n.mietverhaeltnis.sonstigeBetriebskostenVereinbart,
    );
    if (betroffene.length > 0) {
      befunde.push(
        FEHLER(
          'Sonstige Betriebskosten ohne Vereinbarung',
          `Die Positionen ${sonstigeOhneVereinbarung.map((p) => `"${p.bezeichnung}"`).join(', ')} werden als sonstige Betriebskosten umgelegt. ` +
            `Für ${betroffene.map((n) => n.mietverhaeltnis.mieter.join(', ')).join('; ')} ist im Mietvertrag keine ausdrückliche Vereinbarung hinterlegt. ` +
            'Sonstige Betriebskosten sind nur umlagefähig, wenn sie im Mietvertrag einzeln benannt sind.',
          '§ 2 Nr. 17 BetrKV',
          'Kosten',
        ),
      );
    }
  }

  for (const p of positionen) {
    const art = kostenartOderFallback(p.katalogId);
    if (p.betrag <= 0) {
      befunde.push(
        WARNUNG(
          `Position ohne Betrag: ${p.bezeichnung}`,
          'Die Position enthält keinen positiven Betrag und bleibt bei der Verteilung wirkungslos.',
          undefined,
          'Kosten',
        ),
      );
    }
    if ((p.nichtUmlagefaehigerAnteil ?? 0) > p.betrag) {
      befunde.push(
        FEHLER(
          `Vorwegabzug zu hoch: ${p.bezeichnung}`,
          'Der nicht umlagefähige Anteil übersteigt den Gesamtbetrag der Position.',
          undefined,
          'Kosten',
        ),
      );
    }
    if (art.umlagefaehigBis && zeitraum.bis > art.umlagefaehigBis) {
      befunde.push(
        FEHLER(
          `Nicht mehr umlagefähig: ${p.bezeichnung}`,
          `${art.bezeichnung} ist nur für Zeiträume bis zum ${formatDatum(art.umlagefaehigBis)} umlagefähig. ${art.hinweis ?? ''}`.trim(),
          art.fundstelle,
          'Kosten',
        ),
      );
    }
    if (art.hoechstbetragProWohnungUndJahr && einheiten.length > 0) {
      const jahresanteil = gesamtTage / 365;
      const grenze = Math.round(
        art.hoechstbetragProWohnungUndJahr * einheiten.length * jahresanteil,
      );
      if (p.betrag > grenze) {
        befunde.push(
          FEHLER(
            `Höchstbetrag überschritten: ${p.bezeichnung}`,
            `Umlagefähig sind höchstens ${formatEuro(grenze)} (${formatEuro(art.hoechstbetragProWohnungUndJahr)} je Wohnung und Jahr bei ${einheiten.length} Einheiten). Erfasst sind ${formatEuro(p.betrag)}.`,
            art.fundstelle,
            'Kosten',
          ),
        );
      }
    }
    if (art.id === 'BETRKV_2_14' && !(p.nichtUmlagefaehigerAnteil ?? 0)) {
      befunde.push(
        HINWEIS(
          'Hauswartkosten ohne Vorwegabzug',
          'Enthält die Hauswartvergütung Instandhaltungs-, Instandsetzungs- oder Verwaltungstätigkeiten, ist dieser Anteil vorweg abzuziehen. Andernfalls ist die Position insgesamt angreifbar.',
          '§ 2 Nr. 14 BetrKV',
          'Kosten',
        ),
      );
    }
    if (p.belegdatum && (p.belegdatum < zeitraum.von || p.belegdatum > zeitraum.bis)) {
      befunde.push(
        HINWEIS(
          `Belegdatum außerhalb des Zeitraums: ${p.bezeichnung}`,
          `Das Belegdatum ${formatDatum(p.belegdatum)} liegt außerhalb des Abrechnungszeitraums. Das ist beim Abflussprinzip zulässig, beim Leistungsprinzip jedoch zu prüfen.`,
          undefined,
          'Kosten',
        ),
      );
    }
    if (p.verteilerschluessel === 'DIREKTZUORDNUNG' && !p.direktEinheitId) {
      befunde.push(
        FEHLER(
          `Direktzuordnung ohne Einheit: ${p.bezeichnung}`,
          'Für eine direkte Zuordnung muss die betroffene Einheit angegeben werden.',
          undefined,
          'Kosten',
        ),
      );
    }
    if (art.umlagefaehig && !art.erlaubteSchluessel.includes(p.verteilerschluessel)) {
      befunde.push(
        WARNUNG(
          `Ungewöhnlicher Verteilerschlüssel: ${p.bezeichnung}`,
          `Für "${art.bezeichnung}" ist der gewählte Schlüssel untypisch. Prüfen Sie, ob der Mietvertrag einen anderen Maßstab vorgibt.`,
          '§ 556a Abs. 1 BGB',
          'Kosten',
        ),
      );
    }
  }

  const gewerbe = einheiten.filter((e) => e.gewerbe);
  if (gewerbe.length > 0 && ergebnis.vorwegabzuegeGesamt === 0) {
    befunde.push(
      HINWEIS(
        'Gewerbeeinheiten ohne Vorwegabzug',
        `Das Objekt enthält ${gewerbe.length} Gewerbeeinheit(en). Führt die gewerbliche Nutzung zu erheblich höheren Kosten, ist vor der Umlage ein Vorwegabzug für die Gewerbeflächen vorzunehmen.`,
        '§ 556a Abs. 1 BGB',
        'Kosten',
      ),
    );
  }

  // --- Maßstabsmängel aus der Berechnung ------------------------------------
  const maengel = new Set<string>();
  for (const pv of ergebnis.positionsVerteilungen) {
    pv.basis.maengel.forEach((m) => maengel.add(m));
  }
  for (const block of ergebnis.heizkosten?.bloecke ?? []) {
    block.basis.maengel.forEach((m) => maengel.add(m));
  }
  for (const m of maengel) {
    befunde.push(
      FEHLER(
        'Umlagemaßstab unvollständig',
        m,
        '§ 556a BGB',
        'Einheiten / Verbrauch',
      ),
    );
  }

  // --- HeizkostenV ----------------------------------------------------------
  const hk = state.heizkosten.find((h) => h.abrechnungszeitraumId === zeitraum.id);
  const hatHeizpositionen = positionen.some((p) => p.verteilerschluessel === 'HEIZKOSTENV');
  if (hatHeizpositionen && (!hk || !hk.aktiv)) {
    befunde.push(
      FEHLER(
        'Heizkostenabrechnung nicht aktiviert',
        'Es sind Heiz-/Warmwasserkosten erfasst, die Abrechnung nach HeizkostenV ist jedoch nicht aktiviert.',
        'HeizkostenV',
        'Heizkosten',
      ),
    );
  }
  if (hk?.aktiv && hatHeizpositionen) {
    for (const [bezeichnung, wert] of [
      ['Heizung', hk.verbrauchsanteilHeizung],
      ['Warmwasser', hk.verbrauchsanteilWarmwasser],
    ] as const) {
      if (wert < 50 || wert > 70) {
        befunde.push(
          FEHLER(
            `Verbrauchsanteil ${bezeichnung} unzulässig`,
            `Der verbrauchsabhängige Anteil beträgt ${wert} %. Zulässig sind 50 % bis 70 %.`,
            bezeichnung === 'Heizung' ? '§ 7 Abs. 1 HeizkostenV' : '§ 8 Abs. 1 HeizkostenV',
            'Heizkosten',
          ),
        );
      }
    }

    if (hk.warmwasserErmittlung !== 'GETRENNT') {
      const anteil = ermittleWarmwasserAnteil(hk);
      if (anteil.unvollstaendig) {
        befunde.push(
          FEHLER(
            'Warmwasseranteil nicht ermittelbar',
            anteil.herleitung,
            '§ 9 Abs. 2 HeizkostenV',
            'Heizkosten',
          ),
        );
      }
      if (hk.warmwasserErmittlung === 'MANUELL') {
        befunde.push(
          WARNUNG(
            'Warmwasseranteil manuell angesetzt',
            'Bei verbundenen Anlagen ist die auf das Warmwasser entfallende Wärmemenge zu messen oder nach der Formel des § 9 Abs. 2 HeizkostenV zu berechnen. Ein frei gewählter Prozentsatz ist nur ausnahmsweise zulässig.',
            '§ 9 Abs. 2, 3 HeizkostenV',
            'Heizkosten',
          ),
        );
      }
    }

    if (!hk.verbrauchsabhaengigAbgerechnet) {
      befunde.push(
        WARNUNG(
          'Keine verbrauchsabhängige Abrechnung – 15 % Kürzung angewendet',
          `Die Heiz- und Warmwasserkosten werden ohne Verbrauchserfassung verteilt. Der Mieteranteil wurde deshalb um 15 % gekürzt. ${hk.grundKeineVerbrauchserfassung ?? ''}`.trim(),
          '§ 12 Abs. 1 HeizkostenV',
          'Heizkosten',
        ),
      );
    }
    if (hk.verbrauchsinformationErteilt === false) {
      befunde.push(
        WARNUNG(
          'Unterjährige Verbrauchsinformation nicht erteilt',
          'Bei fernablesbarer Ausstattung sind dem Mieter monatliche Verbrauchsinformationen zu erteilen. Werden sie nicht erteilt, kann der Mieter den Abrechnungsbetrag um 3 % kürzen.',
          '§ 6a, § 12 Abs. 1 S. 2 HeizkostenV',
          'Heizkosten',
        ),
      );
    }
  }

  // --- rechnerische Konsistenz ---------------------------------------------
  const verteilteSumme =
    summe(ergebnis.mieterAbrechnungen.map((m) => m.summeKalteBetriebskosten + m.summeHeizUndWarmwasser)) +
    ergebnis.leerstandsanteilVermieter;
  if (verteilteSumme !== ergebnis.gesamtkostenUmlagefaehig) {
    befunde.push(
      FEHLER(
        'Verteilung stimmt nicht mit den Gesamtkosten überein',
        `Verteilt wurden ${formatEuro(verteilteSumme)}, umlagefähig sind ${formatEuro(ergebnis.gesamtkostenUmlagefaehig)}. Differenz: ${formatEuro(ergebnis.gesamtkostenUmlagefaehig - verteilteSumme)}.`,
        undefined,
        'Abrechnung',
      ),
    );
  }

  if (ergebnis.leerstandsanteilVermieter > 0) {
    befunde.push(
      HINWEIS(
        'Leerstandsanteil verbleibt beim Vermieter',
        `Auf Leerstand entfallen ${formatEuro(ergebnis.leerstandsanteilVermieter)} der umlagefähigen Kosten. Diese sind nicht auf die übrigen Mieter verteilt worden, sondern vom Vermieter zu tragen.`,
        undefined,
        'Abrechnung',
      ),
    );
  }

  const anzahlFehler = befunde.filter((b) => b.schweregrad === 'FEHLER').length;
  const anzahlWarnungen = befunde.filter((b) => b.schweregrad === 'WARNUNG').length;

  return {
    befunde,
    anzahlFehler,
    anzahlWarnungen,
    erteilbar: anzahlFehler === 0,
    abrechnungsfristEnde: fristEnde,
    abrechnungsfristAbgelaufen: fristAbgelaufen,
  };
}
