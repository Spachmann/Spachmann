/**
 * Prüfung der Abrechnung auf die formellen und materiellen Anforderungen des
 * deutschen Betriebskostenrechts.
 *
 * Stufen:
 *   fehler   – die Abrechnung ist so nicht wirksam / nicht durchsetzbar
 *   warnung  – rechtlich riskant, muss geprüft werden
 *   hinweis  – Hinweis zur Vollständigkeit oder Transparenz
 */

import { tage, plusMonate, ts, dt, heute, ueberschneidungTage } from './datum.js';
import { euro, zahl, summe } from './money.js';
import { SCHLUESSEL, HEIZ_ARTEN, kostenart } from './katalog.js';
import { verbrauchsanteilZulaessig, ENERGIETRAEGER } from './heizkosten.js';
import { istUmlagefaehig } from './abrechnung.js';
import { rechtsform } from './model.js';

const FEHLER = 'fehler';
const WARNUNG = 'warnung';
const HINWEIS = 'hinweis';

export function pruefe(daten, periode, ergebnis) {
  const befunde = [];
  const add = (stufe, titel, text, quelle) => befunde.push({ stufe, titel, text, quelle });

  pruefeStammdaten(daten, add);
  pruefeZeitraum(periode, ergebnis, add);
  pruefeEinheiten(daten, add);
  pruefeMietverhaeltnisse(daten, periode, add);
  pruefePositionen(daten, periode, ergebnis, add);
  pruefeHeizung(daten, periode, ergebnis, add);
  pruefeErgebnis(ergebnis, add);

  const rang = { [FEHLER]: 0, [WARNUNG]: 1, [HINWEIS]: 2 };
  befunde.sort((a, b) => rang[a.stufe] - rang[b.stufe]);

  return {
    befunde,
    fehler: befunde.filter((b) => b.stufe === FEHLER).length,
    warnungen: befunde.filter((b) => b.stufe === WARNUNG).length,
    hinweise: befunde.filter((b) => b.stufe === HINWEIS).length,
    abrechnungsfaehig: befunde.every((b) => b.stufe !== FEHLER),
  };
}

function pruefeStammdaten(daten, add) {
  const v = daten.vermieter || {};
  if (!v.name) {
    add(FEHLER, 'Vermieter fehlt', 'Die Abrechnung muss erkennen lassen, wer sie erteilt. Ohne Angabe des Vermieters ist sie formell unwirksam.', '§ 259 BGB');
  }
  if (!v.strasse || !v.ort) {
    add(WARNUNG, 'Anschrift des Vermieters unvollständig', 'Der Mieter muss den Abrechnenden erreichen können, u. a. zur Ausübung des Belegeinsichtsrechts.', '§ 259 BGB');
  }

  const form = rechtsform(v.rechtsform);
  if (form.vertretungNoetig && !v.vertretenDurch) {
    add(
      WARNUNG,
      'Vertretung des Vermieters nicht angegeben',
      `Vermieter ist eine ${form.bezeichnung}. Die Abrechnung sollte erkennen lassen, wer für sie handelt – trage die vertretungsberechtigten Personen unter „vertreten durch" ein. Bei einer GbR ist das besonders wichtig, weil sie nur durch ihre Gesellschafter auftreten kann.`,
      '§ 259 BGB, § 709 BGB'
    );
  }
  const o = daten.objekt || {};
  if (!o.strasse || !o.ort) {
    add(FEHLER, 'Objektanschrift fehlt', 'Die Abrechnung muss das Abrechnungsobjekt eindeutig bezeichnen.', 'BGH VIII ZR 84/07');
  }
}

function pruefeZeitraum(periode, ergebnis, add) {
  const t = tage(periode.von, periode.bis);
  if (t <= 0) {
    add(FEHLER, 'Abrechnungszeitraum ungültig', 'Beginn und Ende des Abrechnungszeitraums müssen gesetzt sein und das Ende muss nach dem Beginn liegen.', '§ 556 Abs. 3 BGB');
    return;
  }
  if (t > 366) {
    add(
      FEHLER,
      'Abrechnungszeitraum länger als zwölf Monate',
      `Der Zeitraum umfasst ${t} Tage. Über Betriebskosten ist jährlich abzurechnen; ein längerer Zeitraum macht die Abrechnung unwirksam.`,
      '§ 556 Abs. 3 Satz 1 BGB'
    );
  }

  const frist = plusMonate(periode.bis, 12);
  const zugestellt = periode.zugestelltAm;
  if (!zugestellt) {
    add(
      HINWEIS,
      'Abrechnungsfrist läuft',
      `Die Abrechnung muss dem Mieter spätestens am ${dt(frist)} zugehen. Danach sind Nachforderungen ausgeschlossen, soweit der Vermieter die Verspätung zu vertreten hat.`,
      '§ 556 Abs. 3 Satz 2 und 3 BGB'
    );
  } else if (ts(zugestellt) > ts(frist)) {
    const nachzahlungen = (ergebnis?.ergebnisse || []).filter((e) => e.nachzahlung > 0);
    add(
      FEHLER,
      'Abrechnungsfrist versäumt',
      `Zustellung am ${dt(zugestellt)}, Frist endete am ${dt(frist)}. Nachforderungen sind ausgeschlossen` +
        (nachzahlungen.length
          ? ` – betroffen sind ${nachzahlungen.length} Mietverhältnis(se) mit zusammen ${euro(summe(nachzahlungen.map((n) => n.nachzahlung)))}.`
          : '.') +
        ' Guthaben sind gleichwohl auszuzahlen.',
      '§ 556 Abs. 3 Satz 3 BGB'
    );
  }

  if (zugestellt) {
    add(
      HINWEIS,
      'Einwendungsfrist des Mieters',
      `Der Mieter kann bis zum ${dt(plusMonate(zugestellt, 12))} Einwendungen gegen die Abrechnung erheben.`,
      '§ 556 Abs. 3 Satz 5 und 6 BGB'
    );
  }
}

function pruefeEinheiten(daten, add) {
  if (!daten.einheiten.length) {
    add(FEHLER, 'Keine Einheiten erfasst', 'Ohne Wohneinheiten lässt sich kein Verteilerschlüssel bilden.', '§ 556a BGB');
    return;
  }
  const ohneFlaeche = daten.einheiten.filter((e) => !(e.wohnflaeche > 0));
  if (ohneFlaeche.length) {
    add(
      FEHLER,
      'Wohnfläche fehlt',
      `Für ${ohneFlaeche.map((e) => e.bezeichnung).join(', ')} ist keine Wohnfläche hinterlegt. Die Wohnfläche ist der gesetzliche Auffangschlüssel.`,
      '§ 556a Abs. 1 Satz 1 BGB'
    );
  }

  const summeFlaechen = summe(daten.einheiten.map((e) => e.wohnflaeche || 0));
  const gesamt = daten.objekt?.wohnflaecheGesamt || 0;
  if (gesamt > 0 && Math.abs(gesamt - summeFlaechen) / gesamt > 0.005) {
    add(
      WARNUNG,
      'Wohnflächen stimmen nicht überein',
      `Die Summe der Einheiten beträgt ${zahl(summeFlaechen)} m², im Objekt sind ${zahl(gesamt)} m² hinterlegt. Abweichungen führen dazu, dass entweder zu viel oder zu wenig umgelegt wird.`,
      '§ 556a Abs. 1 BGB'
    );
  }

  const mea = summe(daten.einheiten.map((e) => e.mea || 0));
  if (daten.einheiten.some((e) => e.mea > 0) && Math.abs(mea - 1000) > 0.5 && Math.abs(mea - 100) > 0.5 && Math.abs(mea - 10000) > 0.5) {
    add(HINWEIS, 'Miteigentumsanteile prüfen', `Die MEA summieren sich auf ${zahl(mea)}. Übliche Bezugsgrößen sind 100, 1.000 oder 10.000.`, 'Teilungserklärung');
  }
}

function pruefeMietverhaeltnisse(daten, periode, add) {
  const imZeitraum = daten.mietverhaeltnisse.filter(
    (m) => ueberschneidungTage(m.von, m.bis || periode.bis, periode.von, periode.bis) > 0
  );
  if (!imZeitraum.length) {
    add(FEHLER, 'Kein Mietverhältnis im Abrechnungszeitraum', 'Es gibt niemanden, für den abgerechnet werden könnte.', '§ 556 BGB');
    return;
  }

  for (const m of imZeitraum) {
    if (!m.mieterName) {
      add(FEHLER, 'Mietername fehlt', 'Die Abrechnung muss an einen namentlich bestimmten Mieter gerichtet sein.', '§ 259 BGB');
    }
    const vz =
      m.vzModus === 'gesamt'
        ? (m.vzGesamtBetriebskosten || 0) + (m.vzGesamtHeizkosten || 0)
        : (m.vzBetriebskostenMonat || 0) + (m.vzHeizkostenMonat || 0);
    if (vz === 0) {
      add(
        WARNUNG,
        `Keine Vorauszahlungen bei ${m.mieterName || 'unbenanntem Mieter'}`,
        'Der Abzug der geleisteten Vorauszahlungen gehört zu den formellen Mindestangaben. Sind tatsächlich keine vereinbart, ist das in Ordnung – sonst nachtragen.',
        'BGH VIII ZR 84/07'
      );
    }
    if (!daten.einheiten.some((e) => e.id === m.einheitId)) {
      add(FEHLER, `Mietverhältnis ${m.mieterName} ohne Einheit`, 'Dem Mietverhältnis ist keine gültige Wohneinheit zugeordnet.', '');
    }
  }

  // Nutzerwechsel innerhalb einer Einheit
  const proEinheit = new Map();
  for (const m of imZeitraum) proEinheit.set(m.einheitId, (proEinheit.get(m.einheitId) || 0) + 1);
  for (const [einheitId, anzahl] of proEinheit) {
    if (anzahl > 1) {
      const e = daten.einheiten.find((x) => x.id === einheitId);
      add(
        WARNUNG,
        `Nutzerwechsel in ${e?.bezeichnung || einheitId}`,
        'Bei einem Nutzerwechsel ist eine Zwischenablesung der Verbrauchserfassungsgeräte vorzunehmen. Ohne Zwischenablesung wird der Verbrauch hier nur zeitanteilig geschätzt.',
        '§ 9b HeizkostenV'
      );
    }
  }
}

function pruefePositionen(daten, periode, ergebnis, add) {
  const positionen = periode.positionen || [];
  if (!positionen.length) {
    add(FEHLER, 'Keine Kostenpositionen erfasst', 'Ohne Gesamtkosten kann keine Abrechnung erstellt werden.', 'BGH VIII ZR 84/07');
    return;
  }

  for (const p of positionen) {
    const art = kostenart(p.kostenartId);
    const label = p.bezeichnung || art?.bezeichnung || p.kostenartId;

    if (!art) {
      add(WARNUNG, `Kostenart unbekannt: ${label}`, 'Die Position ist keiner Kostenart zugeordnet und wird nicht umgelegt.', '§ 2 BetrKV');
      continue;
    }
    if ((p.betragBrutto || 0) <= 0) {
      add(HINWEIS, `Position ohne Betrag: ${label}`, 'Die Position wirkt sich nicht aus.', '');
    }
    if ((p.abzugBetrag || 0) > 0 && !p.abzugGrund) {
      add(WARNUNG, `Abzug ohne Begründung: ${label}`, 'Der herausgerechnete nicht umlagefähige Anteil sollte begründet werden, damit die Abrechnung nachvollziehbar bleibt.', '§ 259 BGB');
    }
    if ((p.abzugBetrag || 0) > (p.betragBrutto || 0)) {
      add(FEHLER, `Abzug größer als Betrag: ${label}`, 'Der nicht umlagefähige Abzug übersteigt die Gesamtkosten der Position.', '');
    }

    if (p.kostenartId === 'sonstige' && istUmlagefaehig(p) && !p.imMietvertragVereinbart) {
      add(
        FEHLER,
        `Sonstige Betriebskosten nicht vereinbart: ${label}`,
        'Kosten nach § 2 Nr. 17 BetrKV dürfen nur umgelegt werden, wenn die konkrete Kostenart im Mietvertrag ausdrücklich benannt ist. Eine Sammelklausel genügt nicht.',
        '§ 2 Nr. 17 BetrKV, BGH VIII ZR 137/09'
      );
    }

    if (p.kostenartId === 'antenne_breitband' && istUmlagefaehig(p) && ts(periode.bis) > ts('2024-06-30')) {
      add(
        WARNUNG,
        `Breitband-/TV-Kosten nach dem 30.06.2024: ${label}`,
        'Das Nebenkostenprivileg für Kabel-TV-Sammelverträge ist zum 30.06.2024 entfallen. Umlagefähig bleiben nur der Betrieb einer eigenen Gemeinschaftsantennenanlage sowie das Glasfaser-Bereitstellungsentgelt unter den Voraussetzungen des § 72 TKG.',
        '§ 2 Nr. 15 BetrKV, § 72 TKG'
      );
    }

    if (p.kostenartId === 'hauswart' && istUmlagefaehig(p) && !(p.abzugBetrag > 0)) {
      add(
        WARNUNG,
        'Hauswartkosten ohne Abzug',
        'Anteile für Instandhaltung, Instandsetzung, Erneuerung, Schönheitsreparaturen und Verwaltung sind aus den Hauswartkosten herauszurechnen. Ohne Abzug ist die gesamte Position angreifbar.',
        '§ 2 Nr. 14 BetrKV'
      );
    }

    if (HEIZ_ARTEN.has(p.kostenartId)) {
      add(
        HINWEIS,
        `Heizkostenposition außerhalb der HeizkostenV-Rechnung: ${label}`,
        'Heiz- und Warmwasserkosten werden im Reiter „Heizung & Warmwasser" abgerechnet. Diese Position wird nicht umgelegt, um Doppelerfassungen zu vermeiden.',
        '§§ 6–9 HeizkostenV'
      );
    }

    if (p.schluessel === SCHLUESSEL.DIREKT && !p.direktEinheitId) {
      add(FEHLER, `Direktzuordnung ohne Einheit: ${label}`, 'Bei Direktzuordnung muss eine Einheit ausgewählt sein.', '');
    }
  }

  // Verbrauchsschlüssel ohne Verbrauchswerte
  const verbrauchsPositionen = positionen.filter((p) => istUmlagefaehig(p) && p.schluessel === SCHLUESSEL.VERBRAUCH_WASSER);
  if (verbrauchsPositionen.length) {
    const werte = (periode.verbraeuche || []).filter((v) => v.art === 'kaltwasser' && v.wert > 0);
    if (!werte.length) {
      add(
        FEHLER,
        'Verbrauchsschlüssel ohne Zählerstände',
        'Es sind Positionen nach Wasserverbrauch angelegt, aber keine Verbräuche erfasst. Bitte Verbräuche eintragen oder auf einen anderen Schlüssel wechseln.',
        '§ 556a Abs. 1 Satz 2 BGB'
      );
    }
  }

  // Hinweis auf die Verteilungshinweise aus der Berechnung
  for (const { position, ergebnis: e } of ergebnis?.verteilungen || []) {
    for (const h of e.hinweise) {
      add(WARNUNG, `Verteilung: ${position.bezeichnung || position.kostenartId}`, h, '');
    }
  }

  add(
    HINWEIS,
    'Wirtschaftlichkeitsgebot beachten',
    'Der Vermieter darf nur Kosten umlegen, die bei wirtschaftlicher Betrachtung erforderlich waren. Auffällig teure Positionen sollten belegbar begründet sein.',
    '§ 556 Abs. 3 Satz 1 Halbsatz 2 BGB'
  );
}

function pruefeHeizung(daten, periode, ergebnis, add) {
  const h = periode.heizung || {};
  if (!h.aktiv) {
    add(HINWEIS, 'Keine Heizkostenabrechnung', 'Es werden keine Heiz- und Warmwasserkosten abgerechnet. Bei zentraler Versorgung ist die HeizkostenV zwingend anzuwenden.', '§ 1 HeizkostenV');
    return;
  }

  pruefeErzeuger(h, periode, ergebnis, add);

  const aH = h.anteilVerbrauchHeizung ?? 0.7;
  const aW = h.anteilVerbrauchWarmwasser ?? 0.7;

  if (!verbrauchsanteilZulaessig(aH)) {
    add(FEHLER, 'Verbrauchsanteil Heizung unzulässig', `Der Verbrauchsanteil beträgt ${zahl(aH * 100, 0)} %. Zulässig sind 50 bis 70 %.`, '§ 7 Abs. 1 HeizkostenV');
  }
  if (!verbrauchsanteilZulaessig(aW)) {
    add(FEHLER, 'Verbrauchsanteil Warmwasser unzulässig', `Der Verbrauchsanteil beträgt ${zahl(aW * 100, 0)} %. Zulässig sind 50 bis 70 %.`, '§ 8 Abs. 1 HeizkostenV');
  }

  if (h.verbrauchserfassung === false) {
    add(
      WARNUNG,
      'Keine verbrauchsabhängige Abrechnung',
      'Es wird rein nach Fläche abgerechnet. Der Mieter darf seinen Anteil um 15 % kürzen; die Kürzung ist in dieser Abrechnung bereits berücksichtigt.',
      '§ 12 Abs. 1 HeizkostenV'
    );
  }

  const heiz = ergebnis?.heizung;
  if (h.verbunden) {
    if (!heiz || heiz.warmwasserAufteilung.anteil <= 0) {
      add(
        FEHLER,
        'Warmwasseranteil nicht ermittelt',
        'Bei einer verbundenen Anlage muss die auf die Warmwasserbereitung entfallende Wärmemenge ermittelt werden – vorrangig durch Messung, ersatzweise nach der Formel Q = 2,5 · V · (tw − 10) / 1000.',
        '§ 9 Abs. 2 HeizkostenV'
      );
    } else if (h.warmwasser?.modus === 'formel') {
      add(
        HINWEIS,
        'Warmwasser rechnerisch ermittelt',
        'Seit dem 31.12.2013 ist die Wärmemenge für Warmwasser grundsätzlich mit einem Wärmemengenzähler zu messen. Die Formelberechnung ist nur ersatzweise zulässig.',
        '§ 9 Abs. 2 Satz 1 HeizkostenV'
      );
    }
  }

  if (heiz && (heiz.bezug.verbrauchHeizungGesamt <= 0) && h.verbrauchserfassung !== false) {
    add(FEHLER, 'Keine Heizverbräuche erfasst', 'Ohne erfasste Verbrauchswerte kann der Verbrauchsanteil nicht verteilt werden.', '§ 6 Abs. 1 HeizkostenV');
  }

  const co2Pflichtige = (h.erzeuger || []).filter((e) => ENERGIETRAEGER[e.energietraeger]?.co2Pflichtig);
  const ohneCo2 = co2Pflichtige.filter((e) => (e.kostenCent || 0) > 0 && !(e.co2KostenCent > 0));
  if (ohneCo2.length && ts(periode.bis) >= ts('2023-01-01')) {
    add(
      WARNUNG,
      'CO2-Kosten nicht aufgeteilt',
      `Seit dem 01.01.2023 trägt der Vermieter bei Wohngebäuden je nach Emissionskennwert bis zu 95 % der CO2-Kosten. Die Rechnung muss CO2-Menge und CO2-Kosten ausweisen. Ohne Angabe: ${ohneCo2
        .map((e) => e.bezeichnung || ENERGIETRAEGER[e.energietraeger]?.bezeichnung || 'Wärmeerzeuger')
        .join(', ')}.`,
      '§§ 3, 5–7 CO2KostAufG'
    );
  }
  if (heiz?.co2?.stufe) {
    add(
      HINWEIS,
      'CO2-Kostenaufteilung angewendet',
      `Emissionskennwert ${zahl(heiz.co2.kgProM2, 1)} kg CO₂/m²·a → Stufe ${heiz.co2.stufe.stufe}: Vermieteranteil ${zahl(heiz.co2.anteilVermieter * 100, 0)} % (${euro(heiz.co2.vermieterCent)}).`,
      'Anlage zu § 5 Abs. 1 CO2KostAufG'
    );
  }

  add(
    HINWEIS,
    'Abrechnungs- und Verbrauchsinformationen',
    'Bei fernablesbaren Zählern müssen Mieter seit dem 01.12.2021 monatlich über ihren Verbrauch informiert werden. Fehlt die Information, kann der Mieter den Heizkostenanteil um 3 % kürzen.',
    '§ 6a, § 12 Abs. 1 Satz 2 HeizkostenV'
  );
}

/**
 * Prüft die Wärmeerzeugung – bei einer Hybridanlage aus mehreren Erzeugern
 * kommt es darauf an, dass ihre Wärmemengen gemessen und die CO2-Angaben dem
 * richtigen Energieträger zugeordnet sind.
 */
function pruefeErzeuger(h, periode, ergebnis, add) {
  const liste = h.erzeuger || [];

  if (!liste.length) {
    add(
      FEHLER,
      'Kein Wärmeerzeuger erfasst',
      'Ohne Wärmeerzeuger fehlen die Brennstoff- bzw. Energiekosten. Lege im Reiter „Heizung & Warmwasser" mindestens einen Erzeuger an – bei einer Hybridanlage je einen für jeden Energieträger.',
      '§ 7 Abs. 2 HeizkostenV'
    );
    return;
  }

  const ohneKosten = liste.filter((e) => !(e.kostenCent > 0));
  if (ohneKosten.length) {
    add(
      WARNUNG,
      'Wärmeerzeuger ohne Kosten',
      `Für ${ohneKosten.map((e) => e.bezeichnung || 'einen Erzeuger').join(', ')} sind keine Kosten erfasst. Die Jahresrechnung des Versorgers gehört vollständig in die Abrechnung.`,
      '§ 7 Abs. 2 HeizkostenV'
    );
  }

  // Strom unterliegt nicht dem BEHG – für ihn fallen keine CO2-Kosten nach dem
  // CO2KostAufG an. Eingetragene Beträge blieben unberücksichtigt.
  const falscheCo2 = liste.filter(
    (e) => !ENERGIETRAEGER[e.energietraeger]?.co2Pflichtig && ((e.co2KostenCent || 0) > 0 || (e.co2EmissionKg || 0) > 0)
  );
  if (falscheCo2.length) {
    add(
      WARNUNG,
      'CO2-Kosten bei nicht CO2-pflichtigem Energieträger',
      `Für ${falscheCo2
        .map((e) => e.bezeichnung || 'einen Erzeuger')
        .join(', ')} sind CO2-Angaben erfasst. Strom und Holz unterliegen nicht dem Brennstoffemissionshandelsgesetz; das CO2KostAufG gilt für sie nicht. Die Angaben bleiben in der Abrechnung unberücksichtigt.`,
      '§ 2 Abs. 1 CO2KostAufG, § 2 BEHG'
    );
  }

  const erzeugung = ergebnis?.heizung?.erzeugung;
  if (!erzeugung) return;

  // Bei einer Hybridanlage entscheidet die gemessene Wärmemenge darüber, wie
  // sich die Erzeuger zueinander verhalten – und damit auch über die Höhe des
  // CO2-pflichtigen Anteils.
  if (erzeugung.hybrid && !erzeugung.vollstaendigGemessen) {
    const gerechnet = erzeugung.erzeuger.filter((e) => !e.gemessen).map((e) => e.bezeichnung);
    add(
      WARNUNG,
      'Hybridanlage ohne vollständige Wärmemengenmessung',
      `Die Wärmemenge von ${gerechnet.join(', ')} ist nicht gemessen, sondern aus Menge und Heizwert gerechnet. Bei mehreren Erzeugern bestimmt dieses Verhältnis den Warmwasseranteil und den Emissionskennwert – ein Wärmemengenzähler je Erzeuger macht die Abrechnung nachprüfbar.`,
      '§ 9 Abs. 2 HeizkostenV'
    );
  }

  // Ohne Arbeitszahl liefert eine Wärmepumpe scheinbar nur so viel Wärme wie
  // sie Strom bezieht. Der Warmwasseranteil aus der Formel wird dadurch zu groß.
  const wpOhneBasis = erzeugung.erzeuger.filter(
    (e) => ENERGIETRAEGER[e.energietraeger]?.arbeitszahl && !e.gemessen && e.arbeitszahl <= 1
  );
  if (wpOhneBasis.length) {
    add(
      FEHLER,
      'Wärmepumpe ohne Wärmemengenzähler und ohne Arbeitszahl',
      `Für ${wpOhneBasis
        .map((e) => e.bezeichnung)
        .join(', ')} ist weder eine Wärmemenge gemessen noch eine Jahresarbeitszahl hinterlegt. Der bezogene Strom wird dann als Wärmemenge gewertet – die erzeugte Wärme wird dadurch um ein Mehrfaches zu niedrig angesetzt und der Warmwasseranteil zu hoch. Trage den Zählerstand des Wärmemengenzählers oder die Jahresarbeitszahl ein.`,
      '§ 9 Abs. 2 HeizkostenV'
    );
  }

  if (erzeugung.hybrid) {
    add(
      HINWEIS,
      'Hybridanlage abgerechnet',
      `Die Wärme stammt aus ${erzeugung.anzahl} Erzeugern: ${erzeugung.erzeuger
        .map((e) => `${e.bezeichnung} ${zahl(e.waermeKwh, 0)} kWh`)
        .join(', ')}. Ihre Kosten bilden gemeinsam die Brennstoffkosten; CO2-Kosten fallen nur für den Anteil an, der dem BEHG unterliegt.`,
      '§ 7 Abs. 2 HeizkostenV, § 2 CO2KostAufG'
    );
  }
}

function pruefeErgebnis(ergebnis, add) {
  if (!ergebnis) return;

  const rundung = Math.abs(ergebnis.vermieter.rundungsdifferenz || 0);
  if (rundung > 100) {
    add(
      WARNUNG,
      'Umlageausfall',
      `${euro(ergebnis.vermieter.rundungsdifferenz)} der umlagefähigen Kosten konnten keinem Nutzer zugeordnet werden. Prüfe, ob Bezugsgrößen (Fläche, Personen, Verbrauch) vollständig erfasst sind.`,
      ''
    );
  }

  if (ergebnis.vermieter.leerstandsanteil > 0) {
    add(
      HINWEIS,
      'Leerstandskosten beim Vermieter',
      `${euro(ergebnis.vermieter.leerstandsanteil)} entfallen auf leerstehende Zeiten und werden nicht auf Mieter umgelegt.`,
      '§ 556 Abs. 1 BGB'
    );
  }

  const mit35a = ergebnis.ergebnisse.filter((e) => e.paragraph35a.haushaltsnah + e.paragraph35a.handwerker > 0);
  if (!mit35a.length) {
    add(
      HINWEIS,
      'Keine Lohnanteile nach § 35a EStG ausgewiesen',
      'Mieter können haushaltsnahe Dienstleistungen und Handwerkerleistungen steuerlich geltend machen. Erfasse die Lohnanteile bei den betroffenen Positionen, damit sie in der Abrechnung bescheinigt werden.',
      '§ 35a EStG'
    );
  }

  add(
    HINWEIS,
    'Belegeinsicht gewähren',
    'Der Mieter kann Einsicht in die Abrechnungsbelege verlangen. Die Abrechnung sollte einen entsprechenden Hinweis enthalten – er ist im erzeugten Dokument bereits vorgesehen.',
    '§ 259 BGB, BGH VIII ZR 78/05'
  );
}
