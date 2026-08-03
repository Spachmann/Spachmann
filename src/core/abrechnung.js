/**
 * Abrechnungs-Engine.
 *
 * Erzeugt aus den erfassten Stammdaten eine vollständige Betriebskosten-
 * abrechnung je Mietverhältnis. Der Aufbau folgt den vier formellen
 * Mindestangaben, die der BGH in ständiger Rechtsprechung verlangt
 * (u. a. BGH VIII ZR 84/07):
 *
 *   1. Zusammenstellung der Gesamtkosten je Kostenart
 *   2. Angabe und Erläuterung des Verteilerschlüssels
 *   3. Berechnung des Anteils des Mieters
 *   4. Abzug der geleisteten Vorauszahlungen
 *
 * Nicht umlagefähige Kosten werden vollständig vom Umlageteil getrennt und
 * ausschließlich in der internen Vermieterübersicht ausgewiesen.
 */

import { runde, anteilVon, summe } from './money.js';
import { tage, ueberschneidungTage, schnitt, ts, monateImZeitraum } from './datum.js';
import { SCHLUESSEL, SCHLUESSEL_INFO, kostenart, istUmlagefaehigeArt, HEIZ_ARTEN } from './katalog.js';
import { berechneHeizkosten } from './heizkosten.js';

/**
 * Zerlegt den Abrechnungszeitraum je Einheit in Nutzungsabschnitte.
 * Lücken zwischen Mietverhältnissen werden als Leerstand geführt; die darauf
 * entfallenden Kosten trägt der Vermieter (§ 556 Abs. 1 BGB, Vermietungsrisiko).
 */
export function bildeNutzeinheiten(daten, zeitraum) {
  const nutzeinheiten = [];

  for (const einheit of daten.einheiten) {
    const mv = daten.mietverhaeltnisse
      .filter((m) => m.einheitId === einheit.id)
      .map((m) => ({ mv: m, s: schnitt(m.von, m.bis || zeitraum.bis, zeitraum.von, zeitraum.bis) }))
      .filter((x) => x.s)
      .sort((a, b) => ts(a.s.von) - ts(b.s.von));

    let cursor = ts(zeitraum.von);
    const ende = ts(zeitraum.bis);

    for (const { mv: m, s } of mv) {
      if (ts(s.von) > cursor) {
        nutzeinheiten.push(
          machNutzeinheit(einheit, null, isoVon(cursor), isoVon(ts(s.von) - 86400000), daten)
        );
      }
      nutzeinheiten.push(machNutzeinheit(einheit, m, s.von, s.bis, daten));
      cursor = Math.max(cursor, ts(s.bis) + 86400000);
    }

    if (cursor <= ende) {
      nutzeinheiten.push(machNutzeinheit(einheit, null, isoVon(cursor), isoVon(ende), daten));
    }
  }

  return nutzeinheiten;
}

function isoVon(zeitstempel) {
  return new Date(zeitstempel).toISOString().slice(0, 10);
}

function machNutzeinheit(einheit, mietverhaeltnis, von, bis, daten) {
  const leerstandPersonen = daten.objekt?.leerstandPersonen ?? 1;
  return {
    key: `${einheit.id}:${mietverhaeltnis ? mietverhaeltnis.id : 'leer'}:${von}`,
    einheitId: einheit.id,
    einheitBezeichnung: einheit.bezeichnung,
    mietverhaeltnisId: mietverhaeltnis ? mietverhaeltnis.id : null,
    mieterName: mietverhaeltnis ? mietverhaeltnis.mieterName : 'Leerstand',
    leerstand: !mietverhaeltnis,
    von,
    bis,
    tage: tage(von, bis),
    wohnflaeche: einheit.wohnflaeche || 0,
    mea: einheit.mea || 0,
    personen: mietverhaeltnis ? mietverhaeltnis.personen || 1 : leerstandPersonen,
  };
}

/** Basiswert einer Nutzeinheit für einen Verteilerschlüssel. */
function basiswert(nutz, schluessel) {
  switch (schluessel) {
    case SCHLUESSEL.FLAECHE:
      return nutz.wohnflaeche;
    case SCHLUESSEL.PERSONEN:
      return nutz.personen;
    case SCHLUESSEL.EINHEITEN:
      return 1;
    case SCHLUESSEL.MEA:
      return nutz.mea;
    default:
      return 0;
  }
}

/** Verbrauchswert einer Nutzeinheit aus den erfassten Zählerständen. */
function verbrauchswert(nutz, verbraeuche, art) {
  const genau = verbraeuche.find(
    (v) => v.art === art && v.einheitId === nutz.einheitId && v.mietverhaeltnisId === nutz.mietverhaeltnisId
  );
  if (genau) return genau.wert || 0;

  // Fällt auf den Einheitswert zurück, wenn keine Zwischenablesung erfasst ist.
  const proEinheit = verbraeuche.find(
    (v) => v.art === art && v.einheitId === nutz.einheitId && !v.mietverhaeltnisId
  );
  if (!proEinheit) return 0;

  // Ohne Zwischenablesung wird der Einheitsverbrauch zeitanteilig geteilt.
  return (proEinheit.wert || 0) * (nutz.anteilAmEinheitsZeitraum ?? 1);
}

/** Markiert, welcher Anteil des Einheits-Zeitraums auf jede Nutzeinheit entfällt. */
function setzeZeitanteile(nutzeinheiten) {
  const proEinheit = new Map();
  for (const n of nutzeinheiten) {
    proEinheit.set(n.einheitId, (proEinheit.get(n.einheitId) || 0) + n.tage);
  }
  for (const n of nutzeinheiten) {
    const gesamt = proEinheit.get(n.einheitId) || 0;
    n.anteilAmEinheitsZeitraum = gesamt > 0 ? n.tage / gesamt : 0;
  }
}

/**
 * Verteilt eine einzelne Kostenposition auf die Nutzeinheiten.
 * @returns {{anteile: Map<string, {anteil:number, bezug:number, betrag:number}>, bezugGesamt:number, restVermieter:number, hinweise:string[]}}
 */
export function verteilePosition(position, nutzeinheiten, kontext) {
  const hinweise = [];
  const anteile = new Map();
  const schluessel = position.schluessel;
  const umlagebetrag = Math.max(0, (position.betragBrutto || 0) - (position.abzugBetrag || 0));

  const pVon = position.zeitraumVon || kontext.zeitraum.von;
  const pBis = position.zeitraumBis || kontext.zeitraum.bis;

  if (schluessel === SCHLUESSEL.DIREKT) {
    const treffer = nutzeinheiten.filter((n) => n.einheitId === position.direktEinheitId);
    const gesamtTage = summe(treffer.map((n) => ueberschneidungTage(n.von, n.bis, pVon, pBis)));
    for (const n of treffer) {
      const t = ueberschneidungTage(n.von, n.bis, pVon, pBis);
      const anteil = gesamtTage > 0 ? t / gesamtTage : 0;
      anteile.set(n.key, { anteil, bezug: t, betrag: anteilVon(umlagebetrag, anteil) });
    }
    if (!treffer.length) hinweise.push('Der Position ist keine gültige Einheit zugeordnet.');
    return { anteile, bezugGesamt: gesamtTage, bezugEinheit: 'Tage', restVermieter: rest(umlagebetrag, anteile), hinweise };
  }

  if (schluessel === SCHLUESSEL.VERBRAUCH_WASSER) {
    return verteileVerbrauch(position, nutzeinheiten, kontext, umlagebetrag, hinweise);
  }

  // Zeitanteilige Flächen-, Personen-, Einheiten- oder MEA-Schlüssel
  const gewichte = nutzeinheiten.map((n) => {
    const t = ueberschneidungTage(n.von, n.bis, pVon, pBis);
    return { n, gewicht: basiswert(n, schluessel) * t, bezugTage: t };
  });
  const gesamtGewicht = summe(gewichte.map((g) => g.gewicht));

  for (const g of gewichte) {
    const anteil = gesamtGewicht > 0 ? g.gewicht / gesamtGewicht : 0;
    anteile.set(g.n.key, {
      anteil,
      bezug: basiswert(g.n, schluessel),
      bezugTage: g.bezugTage,
      gewicht: g.gewicht,
      betrag: anteilVon(umlagebetrag, anteil),
    });
  }

  if (gesamtGewicht <= 0) hinweise.push('Bezugsgröße ist null – die Position kann nicht verteilt werden.');

  const info = SCHLUESSEL_INFO[schluessel];
  // Bei ganzjährig gleicher Belegung ist die Bezugsgröße die reine Summe der Basiswerte.
  const tageZeitraum = tage(pVon, pBis);
  const bezugGesamt = tageZeitraum > 0 ? gesamtGewicht / tageZeitraum : 0;

  return {
    anteile,
    bezugGesamt,
    bezugEinheit: info?.einheit || '',
    gewichtGesamt: gesamtGewicht,
    restVermieter: rest(umlagebetrag, anteile),
    hinweise,
  };
}

function verteileVerbrauch(position, nutzeinheiten, kontext, umlagebetrag, hinweise) {
  const anteile = new Map();
  const verbraeuche = kontext.verbraeuche || [];
  const art = position.verbrauchsart || 'kaltwasser';

  const werte = nutzeinheiten.map((n) => ({ n, wert: verbrauchswert(n, verbraeuche, art) }));
  const summeEinheiten = summe(werte.map((w) => w.wert));
  const hauptzaehler = kontext.hauptzaehler?.[art] || 0;
  const modus = kontext.verbrauchsdifferenz || 'verbrauch';

  if (summeEinheiten <= 0) {
    hinweise.push(
      'Für diese Position sind keine Verbrauchswerte erfasst. Bei vorhandener Verbrauchserfassung ist verbrauchsabhängig abzurechnen (§ 556a Abs. 1 Satz 2 BGB).'
    );
    return { anteile, bezugGesamt: 0, bezugEinheit: 'm³', restVermieter: umlagebetrag, hinweise };
  }

  // Differenz zwischen Hauptzähler und Summe der Wohnungszähler
  const differenz = hauptzaehler > summeEinheiten ? hauptzaehler - summeEinheiten : 0;
  let verbrauchsTopf = umlagebetrag;
  let differenzTopf = 0;

  if (differenz > 0 && modus !== 'verbrauch') {
    verbrauchsTopf = anteilVon(umlagebetrag, summeEinheiten / hauptzaehler);
    differenzTopf = umlagebetrag - verbrauchsTopf;
  }

  for (const w of werte) {
    const anteil = summeEinheiten > 0 ? w.wert / summeEinheiten : 0;
    anteile.set(w.n.key, { anteil, bezug: w.wert, betrag: anteilVon(verbrauchsTopf, anteil) });
  }

  // Die Differenzmenge wird als eigene Zeile ausgewiesen. Nur so bleibt die
  // Rechnung „Ihr Maßstab ÷ Gesamtmaßstab = Ihr Anteil" für den Mieter
  // nachprüfbar (BGH: gedanklich und rechnerisch nachvollziehbar).
  let differenzInfo = null;
  if (differenzTopf > 0) {
    differenzInfo = { menge: differenz, hauptzaehler, topf: differenzTopf, modus, anteile: null, bezugGesamt: 0 };

    if (modus === 'flaeche') {
      const flTage = nutzeinheiten.map((n) => ({ n, g: n.wohnflaeche * n.tage }));
      const gesamtGewicht = summe(flTage.map((x) => x.g));
      const tageZeitraum = tage(kontext.zeitraum.von, kontext.zeitraum.bis);
      const differenzAnteile = new Map();
      for (const x of flTage) {
        const anteil = gesamtGewicht > 0 ? x.g / gesamtGewicht : 0;
        differenzAnteile.set(x.n.key, {
          anteil,
          bezug: x.n.wohnflaeche,
          bezugTage: x.n.tage,
          betrag: anteilVon(differenzTopf, anteil),
        });
      }
      differenzInfo.anteile = differenzAnteile;
      differenzInfo.bezugGesamt = tageZeitraum > 0 ? gesamtGewicht / tageZeitraum : 0;
    }
  }

  if (differenz > 0 && modus === 'verbrauch') {
    hinweise.push(
      `Der Hauptzähler weist ${differenz} m³ mehr aus als die Summe der Wohnungszähler. Die Differenz wird anteilig auf alle erfassten Verbräuche umgelegt.`
    );
  }

  return {
    anteile,
    bezugGesamt: summeEinheiten,
    bezugEinheit: 'm³',
    differenzInfo,
    // Nur der Verbrauchstopf wird über diese Zeile verteilt; die Differenz
    // erscheint als eigene Zeile oder verbleibt beim Vermieter.
    verteilbarerBetrag: verbrauchsTopf,
    vermieterTraegt: modus === 'vermieter' ? differenzTopf : 0,
    restVermieter: rest(verbrauchsTopf, anteile),
    hinweise,
  };
}

function rest(gesamt, anteile) {
  let verteilt = 0;
  for (const a of anteile.values()) verteilt += a.betrag;
  return gesamt - verteilt;
}

/**
 * Hauptfunktion: berechnet die vollständige Abrechnung.
 *
 * @param {object} daten   Gesamtdatenbestand (Vermieter, Objekt, Einheiten, Mietverhältnisse)
 * @param {object} periode Abrechnungsobjekt mit von/bis, positionen, verbraeuche, heizung
 */
export function berechneAbrechnung(daten, periode) {
  const zeitraum = { von: periode.von, bis: periode.bis };
  const tageZeitraum = tage(zeitraum.von, zeitraum.bis);

  const nutzeinheiten = bildeNutzeinheiten(daten, zeitraum);
  setzeZeitanteile(nutzeinheiten);

  const kontext = {
    zeitraum,
    verbraeuche: periode.verbraeuche || [],
    hauptzaehler: periode.hauptzaehler || {},
    verbrauchsdifferenz: daten.objekt?.verbrauchsdifferenz || 'verbrauch',
  };

  const alle = periode.positionen || [];
  const umlagefaehig = alle.filter((p) => istUmlagefaehig(p));
  const nichtUmlagefaehig = alle.filter((p) => !istUmlagefaehig(p));

  // --- Heizkosten nach HeizkostenV ---
  const heizung = periode.heizung || {};
  let heizErgebnis = null;
  if (heizung.aktiv) {
    heizErgebnis = berechneHeizkosten({
      erzeuger: heizung.erzeuger || [],
      kosten: heizung.kosten || {},
      co2: heizung.co2 || {},
      verbunden: !!heizung.verbunden,
      kostenWarmwasserSeparat: heizung.kostenWarmwasserSeparat || 0,
      warmwasser: {
        modus: heizung.warmwasser?.modus,
        warmwasserKwh: heizung.warmwasser?.warmwasserKwh,
        warmwasserVolumen: heizung.warmwasser?.volumen,
        temperatur: heizung.warmwasser?.temperatur,
        prozentsatz: heizung.warmwasser?.prozentsatz,
      },
      anteilVerbrauchHeizung: heizung.anteilVerbrauchHeizung,
      anteilVerbrauchWarmwasser: heizung.anteilVerbrauchWarmwasser,
      verbrauchserfassung: heizung.verbrauchserfassung !== false,
      tageZeitraum,
      wohnflaecheGesamt: daten.objekt?.wohnflaecheGesamt || summe(daten.einheiten.map((e) => e.wohnflaeche || 0)),
      nutzer: nutzeinheiten.map((n) => ({
        id: n.key,
        bezeichnung: `${n.einheitBezeichnung} – ${n.mieterName}`,
        leerstand: n.leerstand,
        flaecheTage: n.wohnflaeche * n.tage,
        verbrauchHeizung: verbrauchswert(n, kontext.verbraeuche, 'heizung'),
        verbrauchWarmwasser: verbrauchswert(n, kontext.verbraeuche, 'warmwasser'),
      })),
    });
  }

  // --- Verteilung der laufenden Betriebskosten ---
  const verteilungen = umlagefaehig.map((position) => ({
    position,
    ergebnis: verteilePosition(position, nutzeinheiten, kontext),
  }));

  // --- Ergebnis je Nutzeinheit zusammenstellen ---
  const proNutzeinheit = new Map();
  for (const n of nutzeinheiten) {
    proNutzeinheit.set(n.key, { nutz: n, posten: [], heizposten: null, summe: 0, lohnHaushaltsnah: 0, lohnHandwerker: 0 });
  }

  for (const { position, ergebnis } of verteilungen) {
    const art = kostenart(position.kostenartId);
    const umlagebetrag = Math.max(0, (position.betragBrutto || 0) - (position.abzugBetrag || 0));
    const verteilbar = ergebnis.verteilbarerBetrag ?? umlagebetrag;

    for (const [key, a] of ergebnis.anteile) {
      const ziel = proNutzeinheit.get(key);
      if (!ziel || a.betrag === 0) continue;
      const quote = umlagebetrag > 0 ? a.betrag / umlagebetrag : 0;

      ziel.posten.push({
        positionId: position.id,
        kostenartId: position.kostenartId,
        nr: art?.nr ?? null,
        bezeichnung: position.bezeichnung || art?.bezeichnung || position.kostenartId,
        rechtsgrundlage: art?.rechtsgrundlage || '',
        gesamtkosten: verteilbar,
        gesamtkostenBrutto: position.betragBrutto || 0,
        abzug: position.abzugBetrag || 0,
        abzugGrund: position.abzugGrund || '',
        schluessel: position.schluessel,
        schluesselText: SCHLUESSEL_INFO[position.schluessel]?.kurz || position.schluessel,
        bezugGesamt: ergebnis.bezugGesamt,
        bezugEinheit: ergebnis.bezugEinheit,
        bezugAnteil: a.bezug,
        bezugTage: a.bezugTage,
        anteil: a.anteil,
        betrag: a.betrag,
        zeitraumVon: position.zeitraumVon || zeitraum.von,
        zeitraumBis: position.zeitraumBis || zeitraum.bis,
      });
      ziel.summe += a.betrag;
      ziel.lohnHaushaltsnah += runde((position.lohnanteilHaushaltsnah || 0) * quote);
      ziel.lohnHandwerker += runde((position.lohnanteilHandwerker || 0) * quote);
    }

    // Zählerdifferenz als eigene, nachprüfbare Zeile
    const d = ergebnis.differenzInfo;
    if (d?.anteile) {
      for (const [key, a] of d.anteile) {
        const ziel = proNutzeinheit.get(key);
        if (!ziel || a.betrag === 0) continue;
        ziel.posten.push({
          positionId: `${position.id}:differenz`,
          kostenartId: position.kostenartId,
          nr: art?.nr ?? null,
          bezeichnung: `${position.bezeichnung || art?.bezeichnung || position.kostenartId} – Allgemein- und Schwundwasser`,
          rechtsgrundlage: art?.rechtsgrundlage || '',
          gesamtkosten: d.topf,
          gesamtkostenBrutto: d.topf,
          abzug: 0,
          abzugGrund: '',
          schluessel: SCHLUESSEL.FLAECHE,
          schluesselText: SCHLUESSEL_INFO[SCHLUESSEL.FLAECHE].kurz,
          bezugGesamt: d.bezugGesamt,
          bezugEinheit: SCHLUESSEL_INFO[SCHLUESSEL.FLAECHE].einheit,
          bezugAnteil: a.bezug,
          bezugTage: a.bezugTage,
          anteil: a.anteil,
          betrag: a.betrag,
          zeitraumVon: position.zeitraumVon || zeitraum.von,
          zeitraumBis: position.zeitraumBis || zeitraum.bis,
          erlaeuterung: `Hauptzähler ${d.hauptzaehler} m³ ./. Wohnungszähler ${
            d.hauptzaehler - d.menge
          } m³ = ${d.menge} m³, nach Wohnfläche verteilt`,
        });
        ziel.summe += a.betrag;
      }
    }
  }

  if (heizErgebnis) {
    for (const zeile of heizErgebnis.zeilen) {
      const ziel = proNutzeinheit.get(zeile.id);
      if (!ziel) continue;
      ziel.heizposten = zeile;
      ziel.summe += zeile.summe;
    }
  }

  // --- Je Mietverhältnis aggregieren ---
  const ergebnisse = [];
  for (const mv of daten.mietverhaeltnisse) {
    const abschnitte = nutzeinheiten.filter((n) => n.mietverhaeltnisId === mv.id);
    if (!abschnitte.length) continue;

    const einheit = daten.einheiten.find((e) => e.id === mv.einheitId);
    const posten = [];
    let heizsumme = 0;
    let heizdetails = [];
    let lohnHaushaltsnah = 0;
    let lohnHandwerker = 0;
    let kuerzung15 = 0;

    for (const a of abschnitte) {
      const eintrag = proNutzeinheit.get(a.key);
      for (const p of eintrag.posten) {
        const vorhanden = posten.find((x) => x.positionId === p.positionId);
        if (vorhanden) {
          // Mehrere Abschnitte desselben Mietverhältnisses zusammenführen:
          // Verbrauchswerte addieren sich, Flächen-/Personenmaßstäbe nicht.
          vorhanden.betrag += p.betrag;
          vorhanden.bezugTage = (vorhanden.bezugTage || 0) + (p.bezugTage || 0);
          if (p.schluessel === SCHLUESSEL.VERBRAUCH_WASSER || p.schluessel === SCHLUESSEL.DIREKT) {
            vorhanden.bezugAnteil += p.bezugAnteil;
          }
          vorhanden.anteil += p.anteil;
        } else {
          posten.push({ ...p });
        }
      }
      if (eintrag.heizposten) {
        heizsumme += eintrag.heizposten.summe;
        kuerzung15 += eintrag.heizposten.kuerzung15;
        heizdetails.push(eintrag.heizposten);
      }
      lohnHaushaltsnah += eintrag.lohnHaushaltsnah;
      lohnHandwerker += eintrag.lohnHandwerker;
    }

    posten.sort((a, b) => (a.nr ?? 99) - (b.nr ?? 99));

    const nutzungVon = abschnitte[0].von;
    const nutzungBis = abschnitte[abschnitte.length - 1].bis;
    const nutzungTage = summe(abschnitte.map((a) => a.tage));

    const summeBetriebskosten = summe(posten.map((p) => p.betrag));
    const summeGesamt = summeBetriebskosten + heizsumme;
    const vorauszahlungen = berechneVorauszahlungen(mv, nutzungVon, nutzungBis);
    const saldo = summeGesamt - vorauszahlungen.gesamt;

    ergebnisse.push({
      mietverhaeltnisId: mv.id,
      mieterName: mv.mieterName,
      mieterAnschrift: mv.mieterAnschrift,
      einheit,
      nutzungVon,
      nutzungBis,
      nutzungTage,
      abschnitte,
      posten,
      heizdetails,
      heizsumme,
      kuerzung15,
      summeBetriebskosten,
      summeGesamt,
      vorauszahlungen,
      saldo,
      nachzahlung: saldo > 0 ? saldo : 0,
      guthaben: saldo < 0 ? -saldo : 0,
      paragraph35a: { haushaltsnah: lohnHaushaltsnah, handwerker: lohnHandwerker },
    });
  }

  ergebnisse.sort((a, b) => (a.einheit?.bezeichnung || '').localeCompare(b.einheit?.bezeichnung || '', 'de'));

  // --- Vermieterseitige Übersicht ---
  const leerstandsanteil = summe(
    nutzeinheiten.filter((n) => n.leerstand).map((n) => proNutzeinheit.get(n.key).summe)
  );
  const summeNichtUmlagefaehig = summe(
    nichtUmlagefaehig.map((p) => p.betragBrutto || 0)
  );
  const summeAbzuege = summe(umlagefaehig.map((p) => p.abzugBetrag || 0));
  const summeUmlagefaehigGesamt =
    summe(umlagefaehig.map((p) => Math.max(0, (p.betragBrutto || 0) - (p.abzugBetrag || 0)))) +
    (heizErgebnis ? heizErgebnis.gesamtUmlagefaehig : 0);
  const summeAufMieter = summe(ergebnisse.map((e) => e.summeGesamt));
  // Zählerdifferenzen, die nach Einstellung der Vermieter trägt
  const verbrauchsdifferenzVermieter = summe(verteilungen.map((v) => v.ergebnis.vermieterTraegt || 0));

  return {
    zeitraum,
    tageZeitraum,
    erstelltAm: periode.erstelltAm,
    zugestelltAm: periode.zugestelltAm,
    nutzeinheiten,
    verteilungen,
    heizung: heizErgebnis,
    positionenUmlagefaehig: umlagefaehig,
    positionenNichtUmlagefaehig: nichtUmlagefaehig,
    ergebnisse,
    vermieter: {
      leerstandsanteil,
      nichtUmlagefaehig: summeNichtUmlagefaehig,
      abzuege: summeAbzuege,
      co2Anteil: heizErgebnis?.co2?.vermieterCent || 0,
      verbrauchsdifferenz: verbrauchsdifferenzVermieter,
      kuerzung15: summe(ergebnisse.map((e) => e.kuerzung15)),
      rundungsdifferenz:
        summeUmlagefaehigGesamt - summeAufMieter - leerstandsanteil - verbrauchsdifferenzVermieter,
      gesamtbelastung:
        summeNichtUmlagefaehig +
        summeAbzuege +
        leerstandsanteil +
        verbrauchsdifferenzVermieter +
        (heizErgebnis?.co2?.vermieterCent || 0),
    },
    summen: {
      umlagefaehig: summeUmlagefaehigGesamt,
      nichtUmlagefaehig: summeNichtUmlagefaehig + summeAbzuege,
      gesamtkosten:
        summe(alle.map((p) => p.betragBrutto || 0)) +
        (heizErgebnis ? heizErgebnis.kostenRoh.gesamt : 0),
      aufMieterUmgelegt: summeAufMieter,
    },
  };
}

/** Eine Position gilt als umlagefähig, wenn sie einer BetrKV-Kostenart zugeordnet und nicht manuell ausgeschlossen ist. */
export function istUmlagefaehig(position) {
  if (position.umlagefaehig === false) return false;
  if (!istUmlagefaehigeArt(position.kostenartId)) return false;
  if (HEIZ_ARTEN.has(position.kostenartId)) return false; // läuft über die HeizkostenV-Rechnung
  return true;
}

/** Vorauszahlungen des Mieters im Nutzungszeitraum. */
export function berechneVorauszahlungen(mv, von, bis) {
  if (mv.vzModus === 'gesamt') {
    const betriebskosten = mv.vzGesamtBetriebskosten || 0;
    const heizkosten = mv.vzGesamtHeizkosten || 0;
    return { modus: 'gesamt', monate: monateImZeitraum(von, bis), betriebskosten, heizkosten, gesamt: betriebskosten + heizkosten };
  }
  const monate = monateImZeitraum(von, bis);
  const betriebskosten = (mv.vzBetriebskostenMonat || 0) * monate;
  const heizkosten = (mv.vzHeizkostenMonat || 0) * monate;
  return { modus: 'monatlich', monate, betriebskosten, heizkosten, gesamt: betriebskosten + heizkosten };
}
