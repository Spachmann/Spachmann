/**
 * Alle Erfassungsansichten der App.
 * Jede Funktion liefert HTML; Interaktionen laufen über data-aktion/data-feld
 * und werden zentral in app.js behandelt.
 */

import { esc, optionen } from './dom.js';
import { euro, betragText, zahl, prozent, summe } from '../core/money.js';
import { dt, tage, plusMonate, heute } from '../core/datum.js';
import { BETRIEBSKOSTEN, NICHT_UMLAGEFAEHIG, SCHLUESSEL, SCHLUESSEL_INFO, kostenart, HEIZ_ARTEN } from '../core/katalog.js';
import { HEIZWERT } from '../core/heizkosten.js';
import { STUFEN, EMISSIONSFAKTOR } from '../core/co2.js';
import { istUmlagefaehig, berechneVorauszahlungen } from '../core/abrechnung.js';
import { alleDokumente, mieterDokument, vermieterUebersicht } from './dokument.js';

/* --------------------------------------------------------------- Bausteine */

function kopf(titel, beschreibung, aktionen = '') {
  return `<div class="seiten-kopf">
    <div><h1>${esc(titel)}</h1>${beschreibung ? `<p>${beschreibung}</p>` : ''}</div>
    ${aktionen ? `<div class="kopf-aktionen">${aktionen}</div>` : ''}
  </div>`;
}

function karte(titel, koerper, { hilfe = '', rechts = '' } = {}) {
  return `<section class="karte">
    <div class="karte-kopf">
      <div><h2>${esc(titel)}</h2>${hilfe ? `<p class="hilfe">${hilfe}</p>` : ''}</div>
      ${rechts ? `<div class="rechts">${rechts}</div>` : ''}
    </div>
    <div class="karte-koerper">${koerper}</div>
  </section>`;
}

function txt(label, ziel, feld, wert, { typ = 'text', platzhalter = '', notiz = '', klasse = '', inputmode = '' } = {}) {
  const attr = typ === 'betrag' || typ === 'zahl' || typ === 'int'
    ? `type="text" inputmode="decimal" class="${typ === 'betrag' ? 'betrag' : 'zahl'} ${klasse}"`
    : `type="${typ}" class="${klasse}"`;
  return `<div class="feld">
    <label>${esc(label)}</label>
    <input ${attr} data-ziel="${esc(ziel)}" data-feld="${esc(feld)}" data-typ="${esc(typ)}"
      value="${esc(wert)}" placeholder="${esc(platzhalter)}" ${inputmode ? `inputmode="${inputmode}"` : ''}>
    ${notiz ? `<span class="notiz">${notiz}</span>` : ''}
  </div>`;
}

function auswahl(label, ziel, feld, wert, eintraege, notiz = '', typ = 'text') {
  return `<div class="feld">
    <label>${esc(label)}</label>
    <select data-ziel="${esc(ziel)}" data-feld="${esc(feld)}" data-typ="${esc(typ)}">${optionen(eintraege, wert)}</select>
    ${notiz ? `<span class="notiz">${notiz}</span>` : ''}
  </div>`;
}

function schalter(label, ziel, feld, wert, notiz = '') {
  return `<div class="feld">
    <label class="schalter">
      <input type="checkbox" data-ziel="${esc(ziel)}" data-feld="${esc(feld)}" data-typ="bool" ${wert ? 'checked' : ''}>
      <span>${esc(label)}</span>
    </label>
    ${notiz ? `<span class="notiz">${notiz}</span>` : ''}
  </div>`;
}

function leerzustand(zeichen, titel, text, aktion = '') {
  return `<div class="leer"><div class="gross">${zeichen}</div><h3>${esc(titel)}</h3><p>${text}</p>${aktion}</div>`;
}

function meldung(stufe, titel, text, quelle = '') {
  const zeichen = { fehler: '⛔', warnung: '⚠️', hinweis: 'ℹ️', erfolg: '✅' }[stufe] || 'ℹ️';
  const klasse = stufe === 'hinweis' ? 'hinweis-info' : stufe;
  return `<div class="hinweis ${klasse}">
    <span class="zeichen">${zeichen}</span>
    <div><strong>${esc(titel)}</strong><p>${text}</p>${quelle ? `<span class="quelle">${esc(quelle)}</span>` : ''}</div>
  </div>`;
}

/* ------------------------------------------------------------------ Start */

export function startAnsicht(ctx) {
  const { daten, periode, ergebnis, pruefergebnis } = ctx;

  if (!daten.einheiten.length) {
    return (
      kopf('Nebenkostenabrechnung', 'Erfasse Objekt, Einheiten und Kosten – die App erstellt daraus eine rechtskonforme Abrechnung.') +
      karte(
        'Willkommen',
        leerzustand(
          '🏠',
          'Noch keine Daten erfasst',
          'Lege zuerst deine Stammdaten und Wohneinheiten an – oder lade den Beispieldatensatz, um die App auszuprobieren.',
          `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
             <button class="btn primaer" data-aktion="gehe-zu" data-wert="stammdaten">Stammdaten erfassen</button>
             <button class="btn" data-aktion="demo-laden">Beispieldaten laden</button>
           </div>`
        )
      )
    );
  }

  const anzahlFehler = pruefergebnis?.fehler ?? 0;
  const anzahlWarnungen = pruefergebnis?.warnungen ?? 0;
  const nachzahlungen = ergebnis ? ergebnis.ergebnisse.filter((e) => e.nachzahlung > 0) : [];
  const guthaben = ergebnis ? ergebnis.ergebnisse.filter((e) => e.guthaben > 0) : [];

  const kennzahlen = ergebnis
    ? `<div class="kennzahlen">
      <div class="kennzahl"><div class="titel">Gesamtkosten</div><div class="wert">${euro(ergebnis.summen.gesamtkosten)}</div>
        <div class="zusatz">alle erfassten Rechnungen</div></div>
      <div class="kennzahl gut"><div class="titel">Umlagefähig</div><div class="wert">${euro(ergebnis.summen.umlagefaehig)}</div>
        <div class="zusatz">${prozent(ergebnis.summen.gesamtkosten ? ergebnis.summen.umlagefaehig / ergebnis.summen.gesamtkosten : 0, 1)} der Gesamtkosten</div></div>
      <div class="kennzahl schlecht"><div class="titel">Nicht umlagefähig</div><div class="wert">${euro(ergebnis.summen.nichtUmlagefaehig)}</div>
        <div class="zusatz">trägt der Vermieter</div></div>
      <div class="kennzahl"><div class="titel">Auf Mieter umgelegt</div><div class="wert">${euro(ergebnis.summen.aufMieterUmgelegt)}</div>
        <div class="zusatz">${ergebnis.ergebnisse.length} Mietverhältnis(se)</div></div>
    </div>`
    : '';

  const statusMeldung =
    anzahlFehler > 0
      ? meldung('fehler', `${anzahlFehler} Punkt(e) verhindern eine wirksame Abrechnung`, 'Die Abrechnung sollte so nicht versendet werden. Öffne die Prüfung für Details.')
      : anzahlWarnungen > 0
      ? meldung('warnung', `${anzahlWarnungen} Warnung(en)`, 'Die Abrechnung ist formell erstellbar, einzelne Punkte solltest du aber prüfen.')
      : meldung('erfolg', 'Abrechnung ist erstellbar', 'Alle formellen Mindestanforderungen sind erfüllt.');

  const uebersicht = ergebnis
    ? `<div class="tabelle-rahmen"><table class="liste">
      <thead><tr><th>Einheit</th><th>Mieter</th><th>Nutzungszeitraum</th><th class="zahl">Kosten</th><th class="zahl">Vorauszahlung</th><th class="zahl">Saldo</th></tr></thead>
      <tbody>${ergebnis.ergebnisse
        .map(
          (e) => `<tr>
        <td>${esc(e.einheit?.bezeichnung || '')}</td>
        <td><strong>${esc(e.mieterName)}</strong></td>
        <td>${dt(e.nutzungVon)} – ${dt(e.nutzungBis)}<br><span class="fussnote">${e.nutzungTage} Tage</span></td>
        <td class="zahl">${euro(e.summeGesamt)}</td>
        <td class="zahl">${euro(e.vorauszahlungen.gesamt)}</td>
        <td class="zahl"><span class="merkmal ${e.saldo > 0 ? 'nein' : e.saldo < 0 ? 'ja' : 'neutral'}">${
            e.saldo > 0 ? 'Nachzahlung ' : e.saldo < 0 ? 'Guthaben ' : ''
          }${euro(Math.abs(e.saldo))}</span></td>
      </tr>`
        )
        .join('')}</tbody>
    </table></div>`
    : '<p>Für diesen Zeitraum liegen noch keine Daten vor.</p>';

  return (
    kopf(
      `Abrechnung ${periode?.jahr ?? ''}`,
      `${esc(daten.objekt.bezeichnung || daten.objekt.strasse || 'Objekt')} · ${daten.einheiten.length} Einheiten · ${zahl(
        summe(daten.einheiten.map((e) => e.wohnflaeche || 0))
      )} m²`,
      `<button class="btn primaer" data-aktion="gehe-zu" data-wert="abrechnung">Abrechnung erzeugen</button>`
    ) +
    statusMeldung +
    kennzahlen +
    karte('Ergebnis je Mietverhältnis', uebersicht, {
      hilfe: `${nachzahlungen.length} Nachzahlung(en) · ${guthaben.length} Guthaben`,
    }) +
    karte(
      'Nächste Schritte',
      `<div class="raster">
        ${schrittKachel('📋', 'Kosten erfassen', `${periode?.positionen.length ?? 0} Positionen`, 'kosten')}
        ${schrittKachel('🔥', 'Heizung & Warmwasser', periode?.heizung?.aktiv ? 'aktiv' : 'nicht aktiviert', 'heizung')}
        ${schrittKachel('💧', 'Verbräuche', `${periode?.verbraeuche.length ?? 0} Ablesungen`, 'verbrauch')}
        ${schrittKachel('⚖️', 'Rechtsprüfung', `${anzahlFehler} Fehler, ${anzahlWarnungen} Warnungen`, 'pruefung')}
      </div>`
    )
  );
}

function schrittKachel(zeichen, titel, zusatz, ziel) {
  return `<button class="btn" style="justify-content:flex-start;height:auto;padding:14px;text-align:left"
    data-aktion="gehe-zu" data-wert="${esc(ziel)}">
    <span style="font-size:22px;margin-right:4px">${zeichen}</span>
    <span><span style="display:block;font-weight:650">${esc(titel)}</span>
    <span style="display:block;font-size:13px;color:var(--text-schwach);font-weight:400">${esc(zusatz)}</span></span>
  </button>`;
}

/* ------------------------------------------------------------- Stammdaten */

export function stammdatenAnsicht(ctx) {
  const { daten } = ctx;
  const v = daten.vermieter;
  const o = daten.objekt;
  const summeFlaeche = summe(daten.einheiten.map((e) => e.wohnflaeche || 0));

  return (
    kopf('Stammdaten', 'Vermieter und Abrechnungsobjekt. Diese Angaben erscheinen im Kopf jeder Abrechnung – ohne sie ist die Abrechnung formell angreifbar.') +
    karte(
      'Vermieter / Abrechnender',
      `<div class="raster">
        ${txt('Name oder Firma', 'vermieter', 'name', v.name, { platzhalter: 'Max Mustermann' })}
        ${txt('Straße und Hausnummer', 'vermieter', 'strasse', v.strasse)}
        ${txt('PLZ', 'vermieter', 'plz', v.plz)}
        ${txt('Ort', 'vermieter', 'ort', v.ort)}
        ${txt('Telefon', 'vermieter', 'telefon', v.telefon, { typ: 'tel' })}
        ${txt('E-Mail', 'vermieter', 'email', v.email, { typ: 'email' })}
        ${txt('IBAN', 'vermieter', 'iban', v.iban, { notiz: 'für Nachzahlungen und Erstattungen' })}
        ${txt('Bank', 'vermieter', 'bank', v.bank)}
      </div>`,
      { hilfe: 'Der Mieter muss erkennen können, wer abrechnet und wo er Belegeinsicht nehmen kann (§ 259 BGB).' }
    ) +
    karte(
      'Abrechnungsobjekt',
      `<div class="raster">
        ${txt('Bezeichnung', 'objekt', 'bezeichnung', o.bezeichnung, { platzhalter: 'Mehrfamilienhaus Gartenstraße 12' })}
        ${txt('Straße und Hausnummer', 'objekt', 'strasse', o.strasse)}
        ${txt('PLZ', 'objekt', 'plz', o.plz)}
        ${txt('Ort', 'objekt', 'ort', o.ort)}
        ${txt('Gesamtwohnfläche (m²)', 'objekt', 'wohnflaecheGesamt', zahl(o.wohnflaecheGesamt), {
          typ: 'zahl',
          notiz: `Summe der erfassten Einheiten: ${zahl(summeFlaeche)} m² <button class="btn schlicht klein" data-aktion="flaeche-uebernehmen">übernehmen</button>`,
        })}
        ${auswahl('Gebäudetyp', 'objekt', 'gebaeudetyp', o.gebaeudetyp, [
          ['wohn', 'Wohngebäude'],
          ['nichtwohn', 'Nichtwohngebäude'],
        ], 'maßgeblich für die CO₂-Kostenaufteilung')}
        ${txt('Personen bei Leerstand', 'objekt', 'leerstandPersonen', zahl(o.leerstandPersonen, 0), {
          typ: 'zahl',
          notiz: 'Ansatz für den Personenschlüssel in Leerstandszeiten – die Kosten trägt der Vermieter',
        })}
        ${auswahl('Differenz Hauptzähler / Wohnungszähler', 'objekt', 'verbrauchsdifferenz', o.verbrauchsdifferenz, [
          ['verbrauch', 'anteilig auf alle Verbraucher umlegen'],
          ['flaeche', 'nach Wohnfläche umlegen'],
          ['vermieter', 'trägt der Vermieter'],
        ], 'Behandlung von Schwund- und Allgemeinwasser')}
      </div>`
    )
  );
}

/* --------------------------------------------------------------- Einheiten */

export function einheitenAnsicht(ctx) {
  const { daten } = ctx;

  const inhalt = daten.einheiten.length
    ? daten.einheiten
        .map(
          (e) => `<div class="eintrag">
      <div class="eintrag-kopf">
        <h3>${esc(e.bezeichnung || 'Ohne Bezeichnung')}</h3>
        <span class="merkmal neutral">${zahl(e.wohnflaeche)} m²</span>
        <div class="rechts">
          <button class="btn klein gefahr" data-aktion="einheit-loeschen" data-id="${esc(e.id)}">Löschen</button>
        </div>
      </div>
      <div class="raster">
        ${txt('Bezeichnung', `einheit:${e.id}`, 'bezeichnung', e.bezeichnung)}
        ${txt('Lage', `einheit:${e.id}`, 'lage', e.lage, { platzhalter: '2. OG rechts' })}
        ${txt('Wohnfläche (m²)', `einheit:${e.id}`, 'wohnflaeche', zahl(e.wohnflaeche), { typ: 'zahl' })}
        ${txt('Miteigentumsanteile', `einheit:${e.id}`, 'mea', zahl(e.mea, 2), { typ: 'zahl', notiz: 'optional, nur bei MEA-Schlüssel' })}
      </div>
    </div>`
        )
        .join('')
    : leerzustand('🚪', 'Keine Einheiten', 'Lege für jede vermietbare Wohneinheit einen Eintrag an. Die Wohnfläche ist der gesetzliche Auffangschlüssel (§ 556a Abs. 1 BGB).');

  const summeFlaeche = summe(daten.einheiten.map((e) => e.wohnflaeche || 0));
  const abweichung = daten.objekt.wohnflaecheGesamt > 0 && Math.abs(daten.objekt.wohnflaecheGesamt - summeFlaeche) > 0.5;

  return (
    kopf('Wohneinheiten', 'Alle Einheiten des Objekts – auch leerstehende. Nur so lassen sich Leerstandskosten korrekt beim Vermieter belassen.',
      `<button class="btn primaer" data-aktion="einheit-neu">+ Einheit</button>`) +
    (abweichung
      ? meldung(
          'warnung',
          'Wohnflächen weichen ab',
          `Summe der Einheiten: <strong>${zahl(summeFlaeche)} m²</strong>, im Objekt hinterlegt: <strong>${zahl(
            daten.objekt.wohnflaecheGesamt
          )} m²</strong>. <button class="btn schlicht klein" data-aktion="flaeche-uebernehmen">Summe übernehmen</button>`
        )
      : '') +
    karte(`${daten.einheiten.length} Einheiten · ${zahl(summeFlaeche)} m²`, inhalt)
  );
}

/* ---------------------------------------------------------- Mietverhältnis */

export function mieterAnsicht(ctx) {
  const { daten, periode } = ctx;
  const einheitenListe = daten.einheiten.map((e) => [e.id, e.bezeichnung]);

  if (!daten.einheiten.length) {
    return kopf('Mietverhältnisse', '') + karte('', leerzustand('🚪', 'Erst Einheiten anlegen', 'Ein Mietverhältnis gehört immer zu einer Wohneinheit.',
      `<button class="btn primaer" data-aktion="gehe-zu" data-wert="einheiten">Zu den Einheiten</button>`));
  }

  const inhalt = daten.mietverhaeltnisse.length
    ? daten.mietverhaeltnisse
        .map((m) => {
          const bis = m.bis || (periode ? periode.bis : '');
          const imZeitraum = periode ? tage(periode.von, periode.bis) > 0 : true;
          const vz = berechneVorauszahlungen(m, periode?.von || m.von, periode?.bis || bis);
          return `<div class="eintrag">
      <div class="eintrag-kopf">
        <h3>${esc(m.mieterName || 'Neuer Mieter')}</h3>
        <span class="merkmal neutral">${esc(daten.einheiten.find((e) => e.id === m.einheitId)?.bezeichnung || 'keine Einheit')}</span>
        ${m.bis ? `<span class="merkmal warn">ausgezogen ${dt(m.bis)}</span>` : '<span class="merkmal ja">laufend</span>'}
        <div class="rechts">
          <button class="btn klein gefahr" data-aktion="mv-loeschen" data-id="${esc(m.id)}">Löschen</button>
        </div>
      </div>
      <div class="raster">
        ${txt('Name des Mieters', `mv:${m.id}`, 'mieterName', m.mieterName, { platzhalter: 'Familie Muster' })}
        ${auswahl('Wohneinheit', `mv:${m.id}`, 'einheitId', m.einheitId, einheitenListe)}
        ${txt('Anschrift für die Abrechnung', `mv:${m.id}`, 'mieterAnschrift', m.mieterAnschrift, {
          platzhalter: 'Gartenstraße 12, 70173 Stuttgart',
          notiz: 'Kommas oder Zeilenumbrüche trennen die Zeilen im Anschriftenfeld',
        })}
        ${txt('Mietbeginn', `mv:${m.id}`, 'von', m.von, { typ: 'date' })}
        ${txt('Mietende', `mv:${m.id}`, 'bis', m.bis, { typ: 'date', notiz: 'leer lassen, solange das Mietverhältnis läuft' })}
        ${txt('Personen im Haushalt', `mv:${m.id}`, 'personen', zahl(m.personen, 0), { typ: 'zahl', notiz: 'für den Personenschlüssel' })}
      </div>
      <hr class="trenner">
      <div class="raster">
        ${auswahl('Erfassung der Vorauszahlungen', `mv:${m.id}`, 'vzModus', m.vzModus, [
          ['monatlich', 'monatlicher Betrag'],
          ['gesamt', 'Gesamtbetrag im Zeitraum'],
        ])}
        ${
          m.vzModus === 'gesamt'
            ? txt('Vorauszahlung Betriebskosten gesamt (€)', `mv:${m.id}`, 'vzGesamtBetriebskosten', betragText(m.vzGesamtBetriebskosten), { typ: 'betrag' }) +
              txt('Vorauszahlung Heizkosten gesamt (€)', `mv:${m.id}`, 'vzGesamtHeizkosten', betragText(m.vzGesamtHeizkosten), { typ: 'betrag' })
            : txt('Vorauszahlung Betriebskosten je Monat (€)', `mv:${m.id}`, 'vzBetriebskostenMonat', betragText(m.vzBetriebskostenMonat), { typ: 'betrag' }) +
              txt('Vorauszahlung Heizkosten je Monat (€)', `mv:${m.id}`, 'vzHeizkostenMonat', betragText(m.vzHeizkostenMonat), { typ: 'betrag' })
        }
      </div>
      ${
        periode && imZeitraum
          ? `<p class="fussnote" style="margin-top:10px">Im Abrechnungszeitraum berücksichtigt: <strong>${euro(vz.gesamt)}</strong>${
              vz.modus === 'monatlich' ? ` (${vz.monate} Monate)` : ''
            }</p>`
          : ''
      }
    </div>`;
        })
        .join('')
    : leerzustand('👥', 'Keine Mietverhältnisse', 'Erfasse für jede Einheit die Mietverhältnisse mit Beginn und Ende. Bei einem Mieterwechsel legst du zwei Einträge an – die App rechnet tagegenau ab und behandelt die Lücke als Leerstand.');

  return (
    kopf('Mietverhältnisse', 'Beginn, Ende, Personenzahl und Vorauszahlungen. Bei Mieterwechsel einfach zwei Einträge anlegen.',
      `<button class="btn primaer" data-aktion="mv-neu">+ Mietverhältnis</button>`) +
    karte(`${daten.mietverhaeltnisse.length} Mietverhältnisse`, inhalt)
  );
}

/* ------------------------------------------------------------------ Kosten */

export function kostenAnsicht(ctx) {
  const { daten, periode } = ctx;
  if (!periode) return kopf('Kosten', '') + keineAbrechnung();

  const umlagefaehige = periode.positionen.filter((p) => istUmlagefaehig(p));
  const nicht = periode.positionen.filter((p) => !istUmlagefaehig(p));

  const summeUmlage = summe(umlagefaehige.map((p) => Math.max(0, (p.betragBrutto || 0) - (p.abzugBetrag || 0))));
  const summeNicht = summe(nicht.map((p) => p.betragBrutto || 0)) + summe(umlagefaehige.map((p) => p.abzugBetrag || 0));

  return (
    kopf(
      `Kosten ${periode.jahr}`,
      'Erfasse jede Rechnung einmal. Die Kostenart bestimmt, ob umgelegt werden darf – Verwaltung und Instandhaltung landen automatisch beim Vermieter.',
      `<button class="btn primaer" data-aktion="position-neu">+ Position</button>`
    ) +
    `<div class="kennzahlen">
      <div class="kennzahl gut"><div class="titel">Umlagefähig</div><div class="wert">${euro(summeUmlage)}</div>
        <div class="zusatz">${umlagefaehige.length} Positionen nach § 2 BetrKV</div></div>
      <div class="kennzahl schlecht"><div class="titel">Nicht umlagefähig</div><div class="wert">${euro(summeNicht)}</div>
        <div class="zusatz">${nicht.length} Positionen + Abzüge</div></div>
      <div class="kennzahl"><div class="titel">Erfasste Rechnungen</div><div class="wert">${periode.positionen.length}</div>
        <div class="zusatz">ohne Heizkosten</div></div>
    </div>` +
    karte(
      'Kostenpositionen',
      periode.positionen.length
        ? periode.positionen.map((p) => positionKarte(p, daten)).join('')
        : leerzustand(
            '🧾',
            'Noch keine Kosten erfasst',
            'Lege für jede Rechnung eine Position an. Wähle die Kostenart aus dem Katalog des § 2 BetrKV – die App schlägt den passenden Verteilerschlüssel vor.',
            `<button class="btn primaer" data-aktion="position-neu">Erste Position anlegen</button>`
          )
    ) +
    karte(
      'Kostenarten-Katalog',
      `<p class="fussnote">Umlagefähig ist nur, was in § 2 BetrKV steht. Diese Übersicht zeigt den vollständigen Katalog und die typischen Fallstricke.</p>
      <div class="tabelle-rahmen"><table class="liste">
        <thead><tr><th>Nr.</th><th>Kostenart</th><th>Standardschlüssel</th><th>Hinweis</th></tr></thead>
        <tbody>${BETRIEBSKOSTEN.map(
          (k) => `<tr>
          <td><strong>${k.nr}</strong></td>
          <td>${esc(k.bezeichnung)}<br><span class="fussnote">${esc(k.beispiele.join(', '))}</span></td>
          <td>${esc(SCHLUESSEL_INFO[k.schluessel]?.kurz || '')}</td>
          <td>${k.warnung ? `<span class="fussnote" style="color:var(--gelb)">${esc(k.warnung)}</span>` : k.hinweis ? `<span class="fussnote">${esc(k.hinweis)}</span>` : '<span class="merkmal ja">umlagefähig</span>'}</td>
        </tr>`
        ).join('')}</tbody>
      </table></div>
      <hr class="trenner">
      <div class="tabelle-rahmen"><table class="liste">
        <thead><tr><th>Nicht umlagefähig</th><th>Warum</th><th>Rechtsgrundlage</th></tr></thead>
        <tbody>${NICHT_UMLAGEFAEHIG.map(
          (k) => `<tr>
          <td>${esc(k.bezeichnung)}<br><span class="fussnote">${esc(k.beispiele.join(', '))}</span></td>
          <td>${esc(k.grund)}</td>
          <td><span class="fussnote">${esc(k.rechtsgrundlage)}</span></td>
        </tr>`
        ).join('')}</tbody>
      </table></div>`
    )
  );
}

function positionKarte(p, daten) {
  const art = kostenart(p.kostenartId);
  const umlage = istUmlagefaehig(p);
  const netto = Math.max(0, (p.betragBrutto || 0) - (p.abzugBetrag || 0));
  const istHeiz = HEIZ_ARTEN.has(p.kostenartId);

  const artOptionen = [
    ...BETRIEBSKOSTEN.map((k) => [k.id, `${k.nr}. ${k.bezeichnung}`]),
    ...NICHT_UMLAGEFAEHIG.map((k) => [k.id, `✕ ${k.bezeichnung}`]),
  ];

  const schluesselOptionen = Object.entries(SCHLUESSEL_INFO)
    .filter(([id]) => id !== SCHLUESSEL.HEIZUNG)
    .map(([id, info]) => [id, info.kurz]);

  return `<div class="eintrag">
    <div class="eintrag-kopf">
      <h3>${esc(p.bezeichnung || art?.bezeichnung || 'Neue Position')}</h3>
      <span class="merkmal ${umlage ? 'ja' : 'nein'}">${umlage ? 'umlagefähig' : 'nicht umlagefähig'}</span>
      <span class="merkmal neutral">${euro(netto)}</span>
      <div class="rechts">
        <button class="btn klein gefahr" data-aktion="position-loeschen" data-id="${esc(p.id)}">Löschen</button>
      </div>
    </div>

    <div class="raster">
      ${auswahl('Kostenart', `position:${p.id}`, 'kostenartId', p.kostenartId, artOptionen)}
      ${txt('Eigene Bezeichnung', `position:${p.id}`, 'bezeichnung', p.bezeichnung, {
        platzhalter: art?.bezeichnung || '',
        notiz: 'erscheint so in der Abrechnung',
      })}
      ${txt('Rechnungsbetrag brutto (€)', `position:${p.id}`, 'betragBrutto', betragText(p.betragBrutto), { typ: 'betrag' })}
      ${
        istUmlagefaehigArt(p.kostenartId) && !istHeiz
          ? auswahl('Verteilerschlüssel', `position:${p.id}`, 'schluessel', p.schluessel, schluesselOptionen,
              esc(SCHLUESSEL_INFO[p.schluessel]?.rechtsgrundlage || ''))
          : ''
      }
      ${
        p.schluessel === SCHLUESSEL.DIREKT
          ? auswahl('Einheit', `position:${p.id}`, 'direktEinheitId', p.direktEinheitId, [['', '– bitte wählen –'], ...daten.einheiten.map((e) => [e.id, e.bezeichnung])])
          : ''
      }
      ${
        p.schluessel === SCHLUESSEL.VERBRAUCH_WASSER
          ? auswahl('Verbrauchsart', `position:${p.id}`, 'verbrauchsart', p.verbrauchsart, [
              ['kaltwasser', 'Kaltwasser'],
              ['warmwasser', 'Warmwasser'],
            ])
          : ''
      }
    </div>

    ${art?.warnung ? meldung('warnung', 'Zu dieser Kostenart', esc(art.warnung), art.rechtsgrundlage) : ''}
    ${istHeiz ? meldung('hinweis', 'Wird über die Heizkostenabrechnung erfasst', 'Trage Heiz- und Warmwasserkosten im Reiter „Heizung & Warmwasser" ein, damit die HeizkostenV korrekt angewendet wird. Diese Position wird nicht umgelegt.', '§§ 6–9 HeizkostenV') : ''}

    <details class="aufklapp" style="margin:12px -16px -16px;border-radius:0 0 var(--radius) var(--radius)">
      <summary>Abzüge, § 35a EStG, Zeitraum und Beleg</summary>
      <div>
        <div class="raster">
          ${txt('Nicht umlagefähiger Abzug (€)', `position:${p.id}`, 'abzugBetrag', betragText(p.abzugBetrag), {
            typ: 'betrag',
            notiz: 'z. B. Reparaturanteil des Hausmeisters',
          })}
          ${txt('Begründung des Abzugs', `position:${p.id}`, 'abzugGrund', p.abzugGrund, {
            platzhalter: '20 % Instandhaltungsanteil nach § 2 Nr. 14 BetrKV',
          })}
          ${txt('Lohnanteil haushaltsnahe Dienstleistung (€)', `position:${p.id}`, 'lohnanteilHaushaltsnah', betragText(p.lohnanteilHaushaltsnah), {
            typ: 'betrag',
            notiz: '§ 35a Abs. 2 EStG – wird dem Mieter bescheinigt',
          })}
          ${txt('Lohnanteil Handwerkerleistung (€)', `position:${p.id}`, 'lohnanteilHandwerker', betragText(p.lohnanteilHandwerker), {
            typ: 'betrag',
            notiz: '§ 35a Abs. 3 EStG',
          })}
          ${txt('Kosten gelten ab', `position:${p.id}`, 'zeitraumVon', p.zeitraumVon, {
            typ: 'date',
            notiz: 'nur ausfüllen, wenn die Kosten nur einen Teil des Jahres betreffen',
          })}
          ${txt('Kosten gelten bis', `position:${p.id}`, 'zeitraumBis', p.zeitraumBis, { typ: 'date' })}
          ${txt('Lieferant / Rechnungssteller', `position:${p.id}`, 'lieferant', p.lieferant)}
          ${txt('Belegnummer', `position:${p.id}`, 'beleg', p.beleg)}
        </div>
        <div class="raster" style="margin-top:12px">
          ${schalter('Umlage auf Mieter zulassen', `position:${p.id}`, 'umlagefaehig', p.umlagefaehig !== false,
            'Ausschalten, wenn diese Kosten vertraglich nicht umgelegt werden dürfen')}
          ${
            p.kostenartId === 'sonstige'
              ? schalter('Im Mietvertrag ausdrücklich benannt', `position:${p.id}`, 'imMietvertragVereinbart', p.imMietvertragVereinbart,
                  'Pflicht für § 2 Nr. 17 BetrKV – eine Sammelklausel genügt nicht')
              : ''
          }
        </div>
        <div class="feld" style="margin-top:12px">
          <label>Notiz</label>
          <textarea data-ziel="position:${esc(p.id)}" data-feld="notiz" data-typ="text">${esc(p.notiz)}</textarea>
        </div>
      </div>
    </details>
  </div>`;
}

function istUmlagefaehigArt(id) {
  return BETRIEBSKOSTEN.some((k) => k.id === id);
}

/* ----------------------------------------------------------------- Heizung */

export function heizungAnsicht(ctx) {
  const { daten, periode, ergebnis } = ctx;
  if (!periode) return kopf('Heizung & Warmwasser', '') + keineAbrechnung();

  const h = periode.heizung;
  const heiz = ergebnis?.heizung;

  const kopfBereich = kopf(
    'Heizung & Warmwasser',
    'Abrechnung nach der Heizkostenverordnung: 50–70 % nach Verbrauch, der Rest nach Wohnfläche. CO₂-Kosten werden nach dem Stufenmodell geteilt.'
  );

  if (!h.aktiv) {
    return (
      kopfBereich +
      karte(
        'Heizkostenabrechnung',
        `${schalter('Heiz- und Warmwasserkosten abrechnen', 'heizung', 'aktiv', h.aktiv, 'Bei zentraler Wärmeversorgung ist die Heizkostenverordnung zwingend anzuwenden (§ 1 HeizkostenV).')}
        ${meldung('hinweis', 'Ohne zentrale Anlage', 'Wenn jede Wohnung eine eigene Etagenheizung mit eigenem Liefervertrag hat, rechnet der Mieter direkt mit dem Versorger ab – dann bleibt dieser Bereich aus.', '§ 2 HeizkostenV')}`
      )
    );
  }

  const stufenTabelle = `<div class="tabelle-rahmen"><table class="liste">
    <thead><tr><th>Stufe</th><th>kg CO₂ / m² · Jahr</th><th class="zahl">Mieter</th><th class="zahl">Vermieter</th></tr></thead>
    <tbody>${STUFEN.map((s) => {
      const aktiv = heiz?.co2?.stufe?.stufe === s.stufe;
      return `<tr${aktiv ? ' style="background:var(--akzent-weich);font-weight:650"' : ''}>
        <td>${s.stufe}</td>
        <td>${s.unter === Infinity ? `ab ${s.ab}` : `${s.ab} bis unter ${s.unter}`}</td>
        <td class="zahl">${zahl(s.mieter * 100, 0)} %</td>
        <td class="zahl">${zahl(s.vermieter * 100, 0)} %</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;

  return (
    kopfBereich +
    karte(
      'Anlage',
      `<div class="raster">
        ${schalter('Heiz- und Warmwasserkosten abrechnen', 'heizung', 'aktiv', h.aktiv)}
        ${schalter('Verbundene Anlage (Heizung und Warmwasser aus einer Erzeugung)', 'heizung', 'verbunden', h.verbunden,
          'Dann wird der Warmwasseranteil nach § 9 HeizkostenV herausgerechnet.')}
        ${schalter('Verbrauch wird erfasst', 'heizung', 'verbrauchserfassung', h.verbrauchserfassung !== false,
          'Ausschalten nur, wenn keine Erfassungsgeräte vorhanden sind – dann greift die 15-%-Kürzung des § 12 HeizkostenV.')}
        ${auswahl('Energieträger', 'heizung', 'brennstoff', h.brennstoff,
          Object.entries(HEIZWERT).map(([id, w]) => [id, `${w.bezeichnung} (${zahl(w.wert, 2)} kWh/${w.einheit})`]))}
        ${txt(`Brennstoffmenge (${HEIZWERT[h.brennstoff]?.einheit || ''})`, 'heizung', 'brennstoffmenge', zahl(h.brennstoffmenge, 1), {
          typ: 'zahl',
          notiz: 'aus der Jahresrechnung des Versorgers',
        })}
        ${txt('Gemessene Gesamtwärmemenge (kWh)', 'heizung', 'gesamtwaermeKwh', zahl(h.gesamtwaermeKwh, 0), {
          typ: 'zahl',
          notiz: 'falls ein Wärmemengenzähler vorhanden ist – hat Vorrang vor der Berechnung aus dem Heizwert',
        })}
      </div>`
    ) +
    karte(
      'Kosten der Wärmeversorgung',
      `<div class="raster">
        ${txt('Brennstoff / Fernwärme (€)', 'heizung', 'kosten.brennstoff', betragText(h.kosten.brennstoff), { typ: 'betrag' })}
        ${txt('Betriebsstrom (€)', 'heizung', 'kosten.betriebsstrom', betragText(h.kosten.betriebsstrom), { typ: 'betrag' })}
        ${txt('Wartung der Anlage (€)', 'heizung', 'kosten.wartung', betragText(h.kosten.wartung), {
          typ: 'betrag',
          notiz: 'nur Wartung – Reparaturen sind Instandsetzung und nicht umlagefähig',
        })}
        ${txt('Messdienst und Gerätemiete (€)', 'heizung', 'kosten.messdienst', betragText(h.kosten.messdienst), { typ: 'betrag' })}
        ${txt('Schornsteinfeger / Abgasmessung (€)', 'heizung', 'kosten.schornsteinfeger', betragText(h.kosten.schornsteinfeger), { typ: 'betrag' })}
        ${txt('Sonstiges (€)', 'heizung', 'kosten.sonstiges', betragText(h.kosten.sonstiges), { typ: 'betrag' })}
      </div>`,
      { hilfe: 'Nur Betriebskosten der Anlage nach § 2 Nr. 4–6 BetrKV.' }
    ) +
    karte(
      'Verteilung nach § 7 / § 8 HeizkostenV',
      `<div class="raster">
        ${auswahl('Verbrauchsanteil Heizung', 'heizung', 'anteilVerbrauchHeizung', h.anteilVerbrauchHeizung, [
          [0.5, '50 % Verbrauch / 50 % Grundkosten'],
          [0.6, '60 % Verbrauch / 40 % Grundkosten'],
          [0.7, '70 % Verbrauch / 30 % Grundkosten'],
        ], 'zulässig sind 50 bis 70 % (§ 7 Abs. 1 HeizkostenV)', 'zahl')}
        ${auswahl('Verbrauchsanteil Warmwasser', 'heizung', 'anteilVerbrauchWarmwasser', h.anteilVerbrauchWarmwasser, [
          [0.5, '50 % Verbrauch / 50 % Grundkosten'],
          [0.6, '60 % Verbrauch / 40 % Grundkosten'],
          [0.7, '70 % Verbrauch / 30 % Grundkosten'],
        ], '§ 8 Abs. 1 HeizkostenV', 'zahl')}
      </div>
      ${
        h.verbunden
          ? `<hr class="trenner">
        <h3 style="font-size:15px;margin:0 0 10px">Warmwasseranteil ermitteln (§ 9 HeizkostenV)</h3>
        <div class="raster">
          ${auswahl('Methode', 'heizung', 'warmwasser.modus', h.warmwasser.modus, [
            ['wmz', 'gemessene Wärmemenge (Wärmemengenzähler)'],
            ['formel', 'rechnerisch: Q = 2,5 · V · (tw − 10) / 1000'],
            ['prozent', 'fester Prozentsatz'],
          ], 'Seit 2014 ist die Messung vorrangig; die Formel ist Ersatzlösung.')}
          ${
            h.warmwasser.modus === 'wmz'
              ? txt('Gemessene Wärmemenge Warmwasser (kWh)', 'heizung', 'warmwasser.warmwasserKwh', zahl(h.warmwasser.warmwasserKwh, 0), { typ: 'zahl' })
              : h.warmwasser.modus === 'formel'
              ? txt('Warmwasserverbrauch gesamt (m³)', 'heizung', 'warmwasser.volumen', zahl(h.warmwasser.volumen, 1), { typ: 'zahl' }) +
                txt('Mittlere Warmwassertemperatur (°C)', 'heizung', 'warmwasser.temperatur', zahl(h.warmwasser.temperatur, 0), {
                  typ: 'zahl',
                  notiz: 'Standardannahme 60 °C',
                })
              : txt('Warmwasseranteil (%)', 'heizung', 'warmwasser.prozentsatz', zahl((h.warmwasser.prozentsatz || 0) * 100, 1), {
                  typ: 'prozent',
                  notiz: 'nur zulässig, wenn eine Messung technisch nicht möglich ist',
                })
          }
        </div>`
          : `<hr class="trenner">
        <div class="raster">
          ${txt('Warmwasserkosten separat (€)', 'heizung', 'kostenWarmwasserSeparat', betragText(h.kostenWarmwasserSeparat), {
            typ: 'betrag',
            notiz: 'bei getrennter Warmwassererzeugung',
          })}
        </div>`
      }`
    ) +
    karte(
      'CO₂-Kostenaufteilung (CO2KostAufG)',
      `${meldung('hinweis', 'Pflicht seit 01.01.2023', 'Bei Wohngebäuden trägt der Vermieter je nach Emissionskennwert des Gebäudes 0 bis 95 % der CO₂-Kosten. Der Brennstofflieferant muss CO₂-Menge und CO₂-Kosten auf der Rechnung ausweisen.', '§§ 3, 5–7 CO2KostAufG')}
      <div class="raster">
        ${txt('CO₂-Kosten laut Rechnung (€)', 'heizung', 'co2.kostenCent', betragText(h.co2.kostenCent), { typ: 'betrag' })}
        ${txt('CO₂-Menge laut Rechnung (kg)', 'heizung', 'co2.emissionKg', zahl(h.co2.emissionKg, 0), {
          typ: 'zahl',
          notiz: `Schätzung aus Brennstoffmenge: ${zahl(schaetzung(h), 0)} kg <button class="btn schlicht klein" data-aktion="co2-schaetzen">übernehmen</button>`,
        })}
        ${auswahl('Gebäudetyp', 'heizung', 'co2.gebaeudetyp', h.co2.gebaeudetyp, [
          ['wohn', 'Wohngebäude (Stufenmodell)'],
          ['nichtwohn', 'Nichtwohngebäude (hälftig)'],
        ])}
        ${schalter('Ausnahme nach § 9 CO2KostAufG', 'heizung', 'co2.ausnahme', h.co2.ausnahme,
          'z. B. wenn Denkmalschutz oder Milieuschutz eine energetische Sanierung verhindern')}
      </div>
      ${
        heiz?.co2?.stufe
          ? meldung('erfolg', `Stufe ${heiz.co2.stufe.stufe}: Vermieteranteil ${zahl(heiz.co2.anteilVermieter * 100, 0)} %`,
              `Emissionskennwert <strong>${zahl(heiz.co2.kgProM2, 1)} kg CO₂/m²·a</strong> → der Vermieter trägt <strong>${euro(
                heiz.co2.vermieterCent
              )}</strong>, auf die Mieter entfallen <strong>${euro(heiz.co2.mieterCent)}</strong>.`)
          : ''
      }
      <hr class="trenner">
      ${stufenTabelle}`
    ) +
    (heiz ? karte('Berechnungsergebnis', heizErgebnisTabelle(heiz, ergebnis)) : '')
  );
}

function schaetzung(h) {
  const kwh = (h.brennstoffmenge || 0) * (HEIZWERT[h.brennstoff]?.wert || 0);
  return kwh * (EMISSIONSFAKTOR[h.brennstoff] || 0);
}

function heizErgebnisTabelle(heiz, ergebnis) {
  return `<div class="tabelle-rahmen"><table class="liste">
    <thead><tr>
      <th>Nutzer</th><th class="zahl">Fläche</th><th class="zahl">Heizung Verbr.</th><th class="zahl">WW Verbr.</th>
      <th class="zahl">Grundkosten</th><th class="zahl">Verbrauchskosten</th><th class="zahl">Summe</th>
    </tr></thead>
    <tbody>${heiz.zeilen
      .map(
        (z) => `<tr${z.leerstand ? ' style="opacity:.6"' : ''}>
      <td>${esc(z.bezeichnung)}${z.leerstand ? ' <span class="merkmal warn">Leerstand</span>' : ''}</td>
      <td class="zahl">${zahl(z.flaecheTage / ergebnis.tageZeitraum)} m²</td>
      <td class="zahl">${zahl(z.verbrauchHeizung, 1)}</td>
      <td class="zahl">${zahl(z.verbrauchWarmwasser, 1)}</td>
      <td class="zahl">${euro(z.heizGrund + z.wwGrund)}</td>
      <td class="zahl">${euro(z.heizVerbrauch + z.wwVerbrauch)}</td>
      <td class="zahl"><strong>${euro(z.summe)}</strong></td>
    </tr>`
      )
      .join('')}</tbody>
    <tfoot><tr>
      <td colspan="6">Summe der verteilten Wärmekosten</td>
      <td class="zahl">${euro(heiz.summeVerteilt)}</td>
    </tr></tfoot>
  </table></div>
  <p class="fussnote" style="margin-top:10px">
    Umlagefähige Wärmekosten insgesamt: <strong>${euro(heiz.gesamtUmlagefaehig)}</strong>
    ${heiz.verbunden ? ` · davon Heizung ${euro(heiz.kostenHeizung)}, Warmwasser ${euro(heiz.kostenWarmwasser)}` : ''}
    ${heiz.co2.vermieterCent ? ` · CO₂-Anteil des Vermieters ${euro(heiz.co2.vermieterCent)} bereits abgezogen` : ''}
  </p>`;
}

/* ---------------------------------------------------------------- Verbrauch */

export function verbrauchAnsicht(ctx) {
  const { daten, periode } = ctx;
  if (!periode) return kopf('Verbräuche', '') + keineAbrechnung();

  const arten = [
    ['kaltwasser', 'Kaltwasser (m³)'],
    ['warmwasser', 'Warmwasser (m³)'],
    ['heizung', 'Heizung (Einheiten / kWh)'],
  ];

  // Zeilen: je Einheit und – bei Mieterwechsel – je Mietverhältnis
  const zeilen = [];
  for (const e of daten.einheiten) {
    const mvs = daten.mietverhaeltnisse.filter(
      (m) => m.einheitId === e.id && tage(maxDatum(m.von, periode.von), minDatum(m.bis || periode.bis, periode.bis)) > 0
    );
    if (mvs.length > 1) {
      for (const m of mvs) zeilen.push({ einheit: e, mv: m });
    } else {
      zeilen.push({ einheit: e, mv: null });
    }
  }

  const wert = (einheitId, mvId, art) => {
    const v = periode.verbraeuche.find((x) => x.einheitId === einheitId && x.mietverhaeltnisId === mvId && x.art === art);
    return v ? v.wert : '';
  };

  const tabelle = `<div class="tabelle-rahmen"><table class="liste">
    <thead><tr><th>Einheit / Nutzer</th>${arten.map(([, t]) => `<th class="zahl">${esc(t)}</th>`).join('')}</tr></thead>
    <tbody>${zeilen
      .map(
        (z) => `<tr>
      <td><strong>${esc(z.einheit.bezeichnung)}</strong>${
          z.mv ? `<br><span class="fussnote">${esc(z.mv.mieterName)} · ${dt(z.mv.von)} – ${dt(z.mv.bis || periode.bis)}</span>` : ''
        }</td>
      ${arten
        .map(
          ([art]) => `<td class="zahl"><input type="text" inputmode="decimal" class="zahl"
        style="max-width:120px;margin-left:auto"
        data-aktion="verbrauch-setzen" data-einheit="${esc(z.einheit.id)}" data-mv="${esc(z.mv?.id || '')}" data-art="${esc(art)}"
        value="${wert(z.einheit.id, z.mv?.id || null, art) === '' ? '' : zahl(wert(z.einheit.id, z.mv?.id || null, art), 1)}"></td>`
        )
        .join('')}
    </tr>`
      )
      .join('')}</tbody>
    <tfoot><tr>
      <td>Summe der Wohnungszähler</td>
      ${arten.map(([art]) => `<td class="zahl">${zahl(summe(periode.verbraeuche.filter((v) => v.art === art).map((v) => v.wert)), 1)}</td>`).join('')}
    </tr></tfoot>
  </table></div>`;

  const mehrfach = zeilen.some((z) => z.mv);

  return (
    kopf('Verbräuche', 'Zählerstände bzw. Verbrauchswerte des Abrechnungszeitraums. Bei Mieterwechsel erfasst du die Werte je Nutzer (Zwischenablesung nach § 9b HeizkostenV).') +
    (mehrfach
      ? meldung('hinweis', 'Nutzerwechsel erkannt', 'Für Einheiten mit Mieterwechsel wird je Nutzer eine eigene Zeile geführt. Trage die Werte der Zwischenablesung ein – sonst teilt die App den Jahresverbrauch nur zeitanteilig auf.', '§ 9b HeizkostenV')
      : '') +
    karte('Verbrauch je Nutzer', tabelle) +
    karte(
      'Hauptzähler',
      `<p class="fussnote">Weicht der Hauptzähler von der Summe der Wohnungszähler ab, entsteht Schwund- oder Allgemeinwasser. Wie damit umgegangen wird, stellst du in den Stammdaten ein (aktuell: <strong>${esc(
        { verbrauch: 'anteilig auf alle Verbraucher', flaeche: 'nach Wohnfläche', vermieter: 'trägt der Vermieter' }[daten.objekt.verbrauchsdifferenz]
      )}</strong>).</p>
      <div class="raster">
        ${txt('Hauptzähler Kaltwasser (m³)', 'periode', 'hauptzaehler.kaltwasser', zahl(periode.hauptzaehler.kaltwasser, 1), { typ: 'zahl' })}
        ${txt('Hauptzähler Warmwasser (m³)', 'periode', 'hauptzaehler.warmwasser', zahl(periode.hauptzaehler.warmwasser, 1), { typ: 'zahl' })}
      </div>`
    )
  );
}

function maxDatum(a, b) { return a > b ? a : b; }
function minDatum(a, b) { return a < b ? a : b; }

/* ----------------------------------------------------------------- Prüfung */

export function pruefungAnsicht(ctx) {
  const { pruefergebnis, periode } = ctx;
  if (!periode || !pruefergebnis) return kopf('Prüfung', '') + keineAbrechnung();

  const gruppe = (stufe, titel) => {
    const eintraege = pruefergebnis.befunde.filter((b) => b.stufe === stufe);
    if (!eintraege.length) return '';
    return karte(
      `${titel} (${eintraege.length})`,
      eintraege.map((b) => meldung(stufe, b.titel, esc(b.text), b.quelle)).join('')
    );
  };

  const status = pruefergebnis.abrechnungsfaehig
    ? meldung('erfolg', 'Formelle Mindestanforderungen erfüllt',
        'Zusammenstellung der Gesamtkosten, Angabe und Erläuterung der Verteilerschlüssel, Berechnung des Mieteranteils und Abzug der Vorauszahlungen sind vorhanden.')
    : meldung('fehler', 'Abrechnung noch nicht versandfertig', 'Behebe zuerst die aufgeführten Fehler.');

  return (
    kopf('Rechtsprüfung', 'Automatische Prüfung gegen BGB, BetrKV, HeizkostenV und CO2KostAufG. Sie ersetzt keine Rechtsberatung im Einzelfall.') +
    status +
    `<div class="kennzahlen">
      <div class="kennzahl ${pruefergebnis.fehler ? 'schlecht' : 'gut'}"><div class="titel">Fehler</div><div class="wert">${pruefergebnis.fehler}</div><div class="zusatz">verhindern die Wirksamkeit</div></div>
      <div class="kennzahl"><div class="titel">Warnungen</div><div class="wert">${pruefergebnis.warnungen}</div><div class="zusatz">rechtlich riskant</div></div>
      <div class="kennzahl"><div class="titel">Hinweise</div><div class="wert">${pruefergebnis.hinweise}</div><div class="zusatz">zur Vollständigkeit</div></div>
    </div>` +
    gruppe('fehler', 'Fehler') +
    gruppe('warnung', 'Warnungen') +
    gruppe('hinweis', 'Hinweise') +
    karte(
      'Formelle Mindestanforderungen',
      `<div class="tabelle-rahmen"><table class="liste">
        <thead><tr><th>Anforderung</th><th>Rechtsgrundlage</th><th>Status</th></tr></thead>
        <tbody>
          ${anforderung('Zusammenstellung der Gesamtkosten je Kostenart', 'BGH VIII ZR 84/07', periode.positionen.length > 0)}
          ${anforderung('Angabe und Erläuterung des Verteilerschlüssels', '§ 556a BGB, BGH VIII ZR 84/07', true)}
          ${anforderung('Berechnung des Anteils des Mieters', 'BGH VIII ZR 84/07', true)}
          ${anforderung('Abzug der geleisteten Vorauszahlungen', 'BGH VIII ZR 84/07', true)}
          ${anforderung('Abrechnungszeitraum höchstens zwölf Monate', '§ 556 Abs. 3 Satz 1 BGB', tage(periode.von, periode.bis) <= 366)}
          ${anforderung('Zugang innerhalb der Abrechnungsfrist', '§ 556 Abs. 3 Satz 2 und 3 BGB',
            !periode.zugestelltAm || periode.zugestelltAm <= plusMonate(periode.bis, 12))}
          ${anforderung('Trennung umlagefähiger und nicht umlagefähiger Kosten', '§ 1 Abs. 2, § 2 BetrKV', true)}
          ${anforderung('Heizkosten verbrauchsabhängig (50–70 %)', '§§ 7, 8 HeizkostenV',
            !periode.heizung.aktiv || (periode.heizung.anteilVerbrauchHeizung >= 0.5 && periode.heizung.anteilVerbrauchHeizung <= 0.7))}
        </tbody>
      </table></div>`
    )
  );
}

function anforderung(text, quelle, erfuellt) {
  return `<tr><td>${esc(text)}</td><td><span class="fussnote">${esc(quelle)}</span></td>
    <td><span class="merkmal ${erfuellt ? 'ja' : 'nein'}">${erfuellt ? 'erfüllt' : 'offen'}</span></td></tr>`;
}

/* -------------------------------------------------------------- Abrechnung */

export function abrechnungAnsicht(ctx) {
  const { daten, periode, ergebnis, pruefergebnis, dokumentAuswahl } = ctx;
  if (!periode || !ergebnis) return kopf('Abrechnung', '') + keineAbrechnung();

  const auswahlOptionen = [
    ['alle', 'Alle Mieterabrechnungen'],
    ...ergebnis.ergebnisse.map((e) => [e.mietverhaeltnisId, `${e.einheit?.bezeichnung || ''} – ${e.mieterName}`]),
    ['intern', 'Interne Kostenübersicht (Vermieter)'],
  ];

  let dokument;
  if (dokumentAuswahl === 'intern') {
    dokument = vermieterUebersicht(daten, periode, ergebnis);
  } else if (dokumentAuswahl === 'alle' || !dokumentAuswahl) {
    dokument = alleDokumente(daten, periode, ergebnis);
  } else {
    const e = ergebnis.ergebnisse.find((x) => x.mietverhaeltnisId === dokumentAuswahl);
    dokument = e ? mieterDokument(daten, periode, ergebnis, e) : '<div class="blatt"><p>Nicht gefunden.</p></div>';
  }

  return (
    kopf(
      'Abrechnung',
      'Druckfertiges Dokument im A4-Format. Auf dem iPad: Teilen → Drucken → mit zwei Fingern aufziehen → In Dateien sichern ergibt eine PDF-Datei.',
      `<button class="btn primaer" data-aktion="drucken">Drucken / als PDF sichern</button>`
    ) +
    (pruefergebnis && !pruefergebnis.abrechnungsfaehig
      ? meldung('fehler', `${pruefergebnis.fehler} Fehler in der Prüfung`,
          'Das Dokument wird trotzdem erzeugt, sollte aber vor dem Versand korrigiert werden. <button class="btn schlicht klein" data-aktion="gehe-zu" data-wert="pruefung">Zur Prüfung</button>')
      : '') +
    karte(
      'Zeitraum und Fristen',
      `<div class="raster">
        ${txt('Abrechnungszeitraum von', 'periode', 'von', periode.von, { typ: 'date' })}
        ${txt('bis', 'periode', 'bis', periode.bis, { typ: 'date', notiz: `${tage(periode.von, periode.bis)} Tage` })}
        ${txt('Erstellt am', 'periode', 'erstelltAm', periode.erstelltAm || heute(), { typ: 'date', notiz: 'Datum im Briefkopf' })}
        ${txt('Zugestellt am', 'periode', 'zugestelltAm', periode.zugestelltAm, {
          typ: 'date',
          notiz: `Abrechnungsfrist endet am ${dt(plusMonate(periode.bis, 12))}`,
        })}
        ${txt('Zahlungsfrist (Tage)', 'periode', 'zahlungsfristTage', zahl(periode.zahlungsfristTage, 0), { typ: 'zahl' })}
      </div>`
    ) +
    karte(
      'Dokument',
      `<div class="raster" style="margin-bottom:14px">
        ${auswahl('Anzeigen', 'ansicht', 'dokumentAuswahl', dokumentAuswahl || 'alle', auswahlOptionen)}
      </div>
      <div class="dokument-buehne">${dokument}</div>`,
      { rechts: `<button class="btn klein" data-aktion="drucken">Drucken</button>` }
    )
  );
}

/* ------------------------------------------------------------------- Daten */

export function datenAnsicht(ctx) {
  const { daten } = ctx;
  return (
    kopf('Daten & Sicherung', 'Alle Daten liegen ausschließlich lokal auf diesem Gerät. Es findet keine Übertragung an Server statt.') +
    karte(
      'Abrechnungszeiträume',
      daten.abrechnungen.length
        ? `<div class="tabelle-rahmen"><table class="liste">
        <thead><tr><th>Jahr</th><th>Zeitraum</th><th class="zahl">Positionen</th><th class="zahl">Aktion</th></tr></thead>
        <tbody>${daten.abrechnungen
          .map(
            (a) => `<tr>
          <td><strong>${a.jahr}</strong></td>
          <td>${dt(a.von)} – ${dt(a.bis)}</td>
          <td class="zahl">${a.positionen.length}</td>
          <td class="zahl"><div class="zeilen-aktion">
            <button class="btn klein" data-aktion="abrechnung-waehlen" data-id="${esc(a.id)}">Auswählen</button>
            <button class="btn klein gefahr" data-aktion="abrechnung-loeschen" data-id="${esc(a.id)}">Löschen</button>
          </div></td>
        </tr>`
          )
          .join('')}</tbody>
      </table></div>`
        : '<p>Noch kein Abrechnungszeitraum angelegt.</p>',
      { rechts: `<button class="btn klein primaer" data-aktion="abrechnung-neu">+ Zeitraum</button>` }
    ) +
    karte(
      'Sicherung',
      `<p>Erstelle regelmäßig eine Sicherung. Die Datei enthält alle Stammdaten, Kosten und Abrechnungen.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn primaer" data-aktion="export">Sicherung speichern</button>
        <label class="btn" style="cursor:pointer">Sicherung laden
          <input type="file" accept="application/json,.json" data-aktion="import" style="display:none">
        </label>
      </div>`
    ) +
    karte(
      'Beispiel und Zurücksetzen',
      `<div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" data-aktion="demo-laden">Beispieldaten laden</button>
        <button class="btn gefahr" data-aktion="zuruecksetzen">Alle Daten löschen</button>
      </div>
      <p class="fussnote" style="margin-top:12px">Beide Aktionen überschreiben die aktuell gespeicherten Daten.</p>`
    ) +
    karte(
      'Rechtlicher Hinweis',
      `<p class="fussnote">
        Diese App unterstützt bei der Erstellung einer Betriebskostenabrechnung nach §§ 556, 556a BGB,
        der Betriebskostenverordnung, der Heizkostenverordnung und dem Kohlendioxidkostenaufteilungsgesetz.
        Ob eine Kostenart im konkreten Fall umgelegt werden darf, richtet sich stets zusätzlich nach dem
        Mietvertrag. Die automatische Prüfung ersetzt keine rechtliche Beratung.
      </p>`
    )
  );
}

function keineAbrechnung() {
  return karte(
    '',
    leerzustand('📅', 'Kein Abrechnungszeitraum', 'Lege zuerst einen Abrechnungszeitraum an.',
      `<button class="btn primaer" data-aktion="abrechnung-neu">Zeitraum anlegen</button>`)
  );
}
