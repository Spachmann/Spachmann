/**
 * Erzeugt das Abrechnungsdokument im A4-Format.
 *
 * Der Aufbau bildet die vom BGH geforderten formellen Mindestangaben ab und
 * ergänzt sie um die Angaben, die eine Abrechnung in der Praxis belastbar
 * machen: Erläuterung der Verteilerschlüssel, Bescheinigung nach § 35a EStG,
 * Hinweis auf Belegeinsicht und Einwendungsfrist.
 */

import { euro, zahl, prozent, summe } from '../core/money.js';
import { dt, plusMonate, plusTage, heute, tage } from '../core/datum.js';
import { SCHLUESSEL, SCHLUESSEL_INFO, kostenart } from '../core/katalog.js';
import { HEIZWERT } from '../core/heizkosten.js';
import { esc } from './dom.js';

/** Alle Mieterdokumente eines Abrechnungslaufs. */
export function alleDokumente(daten, periode, ergebnis) {
  return ergebnis.ergebnisse.map((e) => mieterDokument(daten, periode, ergebnis, e)).join('\n');
}

/** Abrechnungsdokument für ein einzelnes Mietverhältnis. */
export function mieterDokument(daten, periode, ergebnis, e) {
  const v = daten.vermieter;
  const o = daten.objekt;
  const datum = periode.erstelltAm || heute();
  const teilzeitraum = e.nutzungTage !== ergebnis.tageZeitraum;

  return `
<div class="blatt">
  ${kopfBereich(v, o, e, periode, datum)}

  <h1>Betriebskostenabrechnung ${esc(String(periode.jahr || ''))}</h1>
  <p>Sehr geehrte Damen und Herren,<br>
  nachstehend erhalten Sie die Abrechnung über die Betriebs- und Heizkosten für den
  Abrechnungszeitraum vom ${dt(periode.von)} bis ${dt(periode.bis)}.</p>

  ${objektKasten(o, e, ergebnis, teilzeitraum)}

  <h2>1. Gesamtkosten, Verteilerschlüssel und Ihr Anteil</h2>
  ${betriebskostenTabelle(e, ergebnis)}

  ${ergebnis.heizung ? heizkostenAbschnitt(periode, ergebnis, e) : ''}

  <h2>${ergebnis.heizung ? '3' : '2'}. Abrechnungsergebnis</h2>
  ${saldoKasten(e, periode, datum)}

  ${paragraph35aKasten(e)}

  ${schluesselErlaeuterung(e, ergebnis)}

  ${hinweiseKasten(periode, datum)}

  <div class="dok-unterschrift">
    <p>Mit freundlichen Grüßen</p>
    <div class="linie"></div>
    <div>${esc(v.name || '')}</div>
  </div>

  ${fussnote()}
</div>`;
}

function kopfBereich(v, o, e, periode, datum) {
  const absender = [v.name, v.strasse, [v.plz, v.ort].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const anschrift = (e.mieterAnschrift || '')
    .split(/\n|,\s*/)
    .map((z) => z.trim())
    .filter(Boolean);

  return `
  <div class="dok-absender">${esc(absender)}</div>
  <div class="dok-kopf">
    <div class="dok-anschrift">
      <span class="zeile"><strong>${esc(e.mieterName || '')}</strong></span>
      ${anschrift.map((z) => `<span class="zeile">${esc(z)}</span>`).join('')}
    </div>
    <div class="dok-meta">
      <div class="zeile"><span>Datum</span><span>${dt(datum)}</span></div>
      <div class="zeile"><span>Objekt</span><span>${esc(o.bezeichnung || o.strasse || '')}</span></div>
      <div class="zeile"><span>Einheit</span><span>${esc(e.einheit?.bezeichnung || '')}</span></div>
      ${v.telefon ? `<div class="zeile"><span>Telefon</span><span>${esc(v.telefon)}</span></div>` : ''}
      ${v.email ? `<div class="zeile"><span>E-Mail</span><span>${esc(v.email)}</span></div>` : ''}
    </div>
  </div>`;
}

function objektKasten(o, e, ergebnis, teilzeitraum) {
  const anschrift = [o.strasse, [o.plz, o.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return `
  <div class="dok-objekt">
    <dl>
      <dt>Abrechnungsobjekt</dt><dd>${esc(anschrift)}</dd>
      <dt>Ihre Wohneinheit</dt><dd>${esc(e.einheit?.bezeichnung || '')}${e.einheit?.lage ? ` (${esc(e.einheit.lage)})` : ''}</dd>
      <dt>Wohnfläche der Einheit</dt><dd>${zahl(e.einheit?.wohnflaeche || 0)} m²</dd>
      <dt>Gesamtwohnfläche</dt><dd>${zahl(o.wohnflaecheGesamt || 0)} m²</dd>
      <dt>Abrechnungszeitraum</dt><dd>${dt(ergebnis.zeitraum.von)} – ${dt(ergebnis.zeitraum.bis)} (${ergebnis.tageZeitraum} Tage)</dd>
      <dt>Ihr Nutzungszeitraum</dt><dd>${dt(e.nutzungVon)} – ${dt(e.nutzungBis)} (${e.nutzungTage} Tage)${
    teilzeitraum ? ' – zeitanteilige Abrechnung' : ''
  }</dd>
      <dt>Personen im Haushalt</dt><dd>${zahl(e.abschnitte[0]?.personen || 0, 0)}</dd>
    </dl>
  </div>`;
}

function betriebskostenTabelle(e, ergebnis) {
  if (!e.posten.length) {
    return '<p><em>Für Ihren Nutzungszeitraum sind keine umlagefähigen Betriebskosten angefallen.</em></p>';
  }

  const zeilen = e.posten
    .map((p) => {
      const info = SCHLUESSEL_INFO[p.schluessel] || {};
      const zeitanteil =
        p.bezugTage && p.bezugTage !== ergebnis.tageZeitraum && info.zeitanteilig
          ? `<span class="klein">zeitanteilig ${p.bezugTage} von ${tage(p.zeitraumVon, p.zeitraumBis)} Tagen</span>`
          : '';
      const abzug =
        p.abzug > 0
          ? `<span class="klein">Gesamtrechnung ${euro(p.gesamtkostenBrutto)}, davon ${euro(p.abzug)} nicht umlagefähig${
              p.abzugGrund ? `: ${esc(p.abzugGrund)}` : ''
            }</span>`
          : '';

      const erlaeuterung = p.erlaeuterung ? `<span class="klein">${esc(p.erlaeuterung)}</span>` : '';

      return `
      <tr>
        <td>${p.nr ? `<strong>${p.nr}.</strong> ` : ''}${esc(p.bezeichnung)}
          <span class="klein">${esc(p.rechtsgrundlage)}</span>${abzug}${erlaeuterung}</td>
        <td class="z">${euro(p.gesamtkosten)}</td>
        <td>${esc(info.kurz || p.schluesselText)}${zeitanteil}</td>
        <td class="z">${bezugText(p, 'gesamt')}</td>
        <td class="z">${bezugText(p, 'anteil')}</td>
        <td class="z">${prozent(p.anteil)}</td>
        <td class="z"><strong>${euro(p.betrag)}</strong></td>
      </tr>`;
    })
    .join('');

  return `
  <div class="tabelle-rahmen">
  <table class="dok fest">
    <colgroup>
      <col style="width:32%"><col style="width:12%"><col style="width:14%">
      <col style="width:13%"><col style="width:11%"><col style="width:7%"><col style="width:11%">
    </colgroup>
    <thead>
      <tr>
        <th>Kostenart</th>
        <th class="z">Gesamtkosten</th>
        <th>Schlüssel</th>
        <th class="z">Maßstab gesamt</th>
        <th class="z">Ihr Maßstab</th>
        <th class="z">Anteil</th>
        <th class="z">Ihr Betrag</th>
      </tr>
    </thead>
    <tbody>${zeilen}</tbody>
    <tfoot>
      <tr class="summe">
        <td colspan="6">Summe der umlagefähigen Betriebskosten</td>
        <td class="z">${euro(e.summeBetriebskosten)}</td>
      </tr>
    </tfoot>
  </table>
  </div>`;
}

function bezugText(p, welche) {
  const wert = welche === 'gesamt' ? p.bezugGesamt : p.bezugAnteil;
  if (p.schluessel === SCHLUESSEL.EINHEITEN) {
    return welche === 'gesamt' ? `${zahl(wert, 0)} Einh.` : '1 Einh.';
  }
  if (p.schluessel === SCHLUESSEL.DIREKT) return welche === 'gesamt' ? '–' : 'direkt';
  const einheit = p.bezugEinheit ? ` ${p.bezugEinheit}` : '';
  return `${zahl(wert, p.schluessel === SCHLUESSEL.PERSONEN ? 1 : 2)}${einheit}`;
}

function heizkostenAbschnitt(periode, ergebnis, e) {
  const h = ergebnis.heizung;
  const zeilen = e.heizdetails;
  if (!zeilen.length) return '';

  const sum = (feld) => summe(zeilen.map((z) => z[feld]));
  const brennstoffText = HEIZWERT[periode.heizung?.brennstoff]?.bezeichnung || periode.heizung?.brennstoff || '';

  const wwZeilen = h.kostenWarmwasser > 0
    ? `
      <tr>
        <td>Warmwasser – Grundkosten (${zahl((1 - h.anteilVerbrauchWarmwasser) * 100, 0)} % nach Wohnfläche)</td>
        <td class="z">${euro(h.toepfe.wwGrundTopf)}</td>
        <td class="z">${zahl(h.bezug.flaecheTageGesamt / ergebnis.tageZeitraum)} m²</td>
        <td class="z">${zahl(summe(zeilen.map((z) => z.flaecheTage)) / ergebnis.tageZeitraum)} m²</td>
        <td class="z">${euro(sum('wwGrund'))}</td>
      </tr>
      <tr>
        <td>Warmwasser – Verbrauchskosten (${zahl(h.anteilVerbrauchWarmwasser * 100, 0)} % nach Verbrauch)</td>
        <td class="z">${euro(h.toepfe.wwVerbrauchTopf)}</td>
        <td class="z">${zahl(h.bezug.verbrauchWarmwasserGesamt, 1)} m³</td>
        <td class="z">${zahl(summe(zeilen.map((z) => z.verbrauchWarmwasser)), 1)} m³</td>
        <td class="z">${euro(sum('wwVerbrauch'))}</td>
      </tr>`
    : '';

  const kuerzung = sum('kuerzung15');

  return `
  <h2>2. Heiz- und Warmwasserkosten nach der Heizkostenverordnung</h2>

  <table class="dok">
    <thead>
      <tr><th>Gesamtkosten der Wärmeversorgung</th><th class="z">Betrag</th></tr>
    </thead>
    <tbody>
      <tr><td>Brennstoffkosten${brennstoffText ? ` (${esc(brennstoffText)})` : ''}</td><td class="z">${euro(h.kostenRoh.brennstoffBrutto)}</td></tr>
      ${
        h.co2.vermieterCent > 0
          ? `<tr><td>./. vom Vermieter zu tragender CO₂-Kostenanteil – Emissionskennwert ${zahl(
              h.co2.kgProM2,
              1
            )} kg CO₂/m²·a, Stufe ${h.co2.stufe.stufe}, Vermieteranteil ${zahl(h.co2.anteilVermieter * 100, 0)} % (§§ 5–7 CO2KostAufG)</td><td class="z">− ${euro(
              h.co2.vermieterCent
            )}</td></tr>`
          : ''
      }
      ${zeileWennNichtNull('Betriebsstrom', periode.heizung?.kosten?.betriebsstrom)}
      ${zeileWennNichtNull('Wartung und Instandhaltung der Heizungsanlage', periode.heizung?.kosten?.wartung)}
      ${zeileWennNichtNull('Messdienst, Gerätemiete und Abrechnung', periode.heizung?.kosten?.messdienst)}
      ${zeileWennNichtNull('Schornsteinfeger / Abgasmessung', periode.heizung?.kosten?.schornsteinfeger)}
      ${zeileWennNichtNull('Sonstige Betriebskosten der Anlage', periode.heizung?.kosten?.sonstiges)}
      <tr class="zwischensumme"><td>Umlagefähige Gesamtkosten der Wärmeversorgung</td><td class="z">${euro(h.gesamtUmlagefaehig)}</td></tr>
      ${
        h.verbunden
          ? `<tr><td>davon Warmwasserbereitung – ${esc(h.warmwasserAufteilung.methode)}${
              h.warmwasserAufteilung.warmwasserKwh
                ? `; ${zahl(h.warmwasserAufteilung.warmwasserKwh, 0)} kWh von ${zahl(h.warmwasserAufteilung.gesamtwaermeKwh, 0)} kWh = ${prozent(
                    h.warmwasserAufteilung.anteil
                  )}`
                : ''
            }</td><td class="z">${euro(h.kostenWarmwasser)}</td></tr>
             <tr><td>davon Raumheizung</td><td class="z">${euro(h.kostenHeizung)}</td></tr>`
          : ''
      }
    </tbody>
  </table>

  <h3>Ihr Anteil</h3>
  <table class="dok">
    <thead>
      <tr>
        <th>Position</th><th class="z">Gesamtkosten</th>
        <th class="z">Gesamtmaßstab</th><th class="z">Ihr Maßstab</th><th class="z">Ihr Betrag</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Heizung – Grundkosten (${zahl((1 - h.anteilVerbrauchHeizung) * 100, 0)} % nach Wohnfläche, § 7 Abs. 1 HeizkostenV)</td>
        <td class="z">${euro(h.toepfe.heizGrundTopf)}</td>
        <td class="z">${zahl(h.bezug.flaecheTageGesamt / ergebnis.tageZeitraum)} m²</td>
        <td class="z">${zahl(summe(zeilen.map((z) => z.flaecheTage)) / ergebnis.tageZeitraum)} m²</td>
        <td class="z">${euro(sum('heizGrund'))}</td>
      </tr>
      <tr>
        <td>Heizung – Verbrauchskosten (${zahl(h.anteilVerbrauchHeizung * 100, 0)} % nach erfasstem Verbrauch)</td>
        <td class="z">${euro(h.toepfe.heizVerbrauchTopf)}</td>
        <td class="z">${zahl(h.bezug.verbrauchHeizungGesamt, 1)} E</td>
        <td class="z">${zahl(summe(zeilen.map((z) => z.verbrauchHeizung)), 1)} E</td>
        <td class="z">${euro(sum('heizVerbrauch'))}</td>
      </tr>
      ${wwZeilen}
      ${
        kuerzung > 0
          ? `<tr><td>./. Kürzung um 15 %, weil nicht verbrauchsabhängig abgerechnet wurde (§ 12 Abs. 1 HeizkostenV)</td><td class="z"></td><td class="z"></td><td class="z"></td><td class="z">− ${euro(
              kuerzung
            )}</td></tr>`
          : ''
      }
    </tbody>
    <tfoot>
      <tr class="summe">
        <td colspan="4">Summe Ihrer Heiz- und Warmwasserkosten</td>
        <td class="z">${euro(e.heizsumme)}</td>
      </tr>
    </tfoot>
  </table>
  <p class="klein" style="font-size:7.6pt;color:#444">
    „E" bezeichnet die Anzeigeeinheiten der Heizkostenverteiler bzw. kWh bei Wärmemengenzählern.
  </p>`;
}

function zeileWennNichtNull(text, betrag) {
  if (!betrag) return '';
  return `<tr><td>${esc(text)}</td><td class="z">${euro(betrag)}</td></tr>`;
}

function saldoKasten(e, periode, datum) {
  const faellig = plusTage(datum, periode.zahlungsfristTage || 30);
  return `
  <div class="dok-saldo">
    <table>
      <tr><td>Umlagefähige Betriebskosten (Ziffer 1)</td><td class="z">${euro(e.summeBetriebskosten)}</td></tr>
      ${e.heizsumme ? `<tr><td>Heiz- und Warmwasserkosten (Ziffer 2)</td><td class="z">${euro(e.heizsumme)}</td></tr>` : ''}
      <tr><td><strong>Summe Ihrer Kosten</strong></td><td class="z"><strong>${euro(e.summeGesamt)}</strong></td></tr>
      <tr>
        <td>./. geleistete Vorauszahlungen${
          e.vorauszahlungen.modus === 'monatlich'
            ? ` (${e.vorauszahlungen.monate} Monate à ${euro(
                (e.vorauszahlungen.betriebskosten + e.vorauszahlungen.heizkosten) / Math.max(1, e.vorauszahlungen.monate)
              )})`
            : ''
        }</td>
        <td class="z">− ${euro(e.vorauszahlungen.gesamt)}</td>
      </tr>
      <tr class="ergebnis">
        <td>${e.saldo > 0 ? 'Nachzahlung' : e.saldo < 0 ? 'Guthaben zu Ihren Gunsten' : 'Ausgeglichen'}</td>
        <td class="z">${euro(Math.abs(e.saldo))}</td>
      </tr>
    </table>
  </div>
  ${
    e.saldo > 0
      ? `<p>Wir bitten um Überweisung des Nachzahlungsbetrags von <strong>${euro(e.saldo)}</strong> bis zum <strong>${dt(
          faellig
        )}</strong>.</p>`
      : e.saldo < 0
      ? `<p>Das Guthaben von <strong>${euro(e.guthaben)}</strong> erstatten wir Ihnen bis zum <strong>${dt(
          faellig
        )}</strong> auf das uns bekannte Konto.</p>`
      : '<p>Die Vorauszahlungen entsprechen exakt den angefallenen Kosten. Es ergibt sich keine Nachzahlung und kein Guthaben.</p>'
  }`;
}

function paragraph35aKasten(e) {
  const gesamt = e.paragraph35a.haushaltsnah + e.paragraph35a.handwerker;
  if (gesamt <= 0) return '';
  return `
  <div class="dok-kasten">
    <h3>Bescheinigung für Ihre Einkommensteuererklärung (§ 35a EStG)</h3>
    <p>In den oben abgerechneten Beträgen sind folgende auf Sie entfallende Lohn-, Maschinen- und
    Fahrtkostenanteile (jeweils einschließlich Umsatzsteuer, ohne Materialkosten) enthalten:</p>
    <table style="width:100%;border-collapse:collapse;font-size:8.8pt;margin-top:2mm">
      <tr><td style="padding:1mm 0">Haushaltsnahe Dienstleistungen (§ 35a Abs. 2 EStG)</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${euro(e.paragraph35a.haushaltsnah)}</td></tr>
      <tr><td style="padding:1mm 0">Handwerkerleistungen (§ 35a Abs. 3 EStG)</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${euro(e.paragraph35a.handwerker)}</td></tr>
      <tr><td style="padding:1.5mm 0;border-top:.5pt solid #666;font-weight:700">Summe</td>
          <td style="text-align:right;border-top:.5pt solid #666;font-weight:700;font-variant-numeric:tabular-nums">${euro(gesamt)}</td></tr>
    </table>
    <p style="margin-top:2mm">Die Beträge wurden nach Ihrem Anteil an den jeweiligen Gesamtkosten ermittelt.
    Eine Steuerermäßigung setzt voraus, dass die Zahlung unbar erfolgt ist.</p>
  </div>`;
}

function schluesselErlaeuterung(e, ergebnis) {
  const verwendet = new Map();
  for (const p of e.posten) {
    if (!verwendet.has(p.schluessel)) verwendet.set(p.schluessel, SCHLUESSEL_INFO[p.schluessel]);
  }
  if (ergebnis.heizung) {
    verwendet.set(SCHLUESSEL.HEIZUNG, SCHLUESSEL_INFO[SCHLUESSEL.HEIZUNG]);
  }
  if (!verwendet.size) return '';

  const punkte = [...verwendet.entries()]
    .filter(([, info]) => info)
    .map(
      ([, info]) =>
        `<li><strong>${esc(info.kurz)}:</strong> ${esc(info.bezeichnung)}${
          info.rechtsgrundlage ? ` – <em>${esc(info.rechtsgrundlage)}</em>` : ''
        }</li>`
    )
    .join('');

  return `
  <div class="dok-kasten">
    <h3>Erläuterung der verwendeten Verteilerschlüssel</h3>
    <ul>${punkte}</ul>
    <p style="margin-top:2mm">Bei einem unterjährigen Nutzungszeitraum werden die nicht verbrauchsabhängigen
    Kosten tagegenau auf Ihren Nutzungszeitraum umgerechnet. Kosten für Zeiten des Leerstands trägt der Vermieter.</p>
  </div>`;
}

function hinweiseKasten(periode, datum) {
  const einwendungsfrist = plusMonate(periode.zugestelltAm || datum, 12);
  return `
  <div class="dok-kasten">
    <h3>Rechtliche Hinweise</h3>
    <ul>
      <li><strong>Belegeinsicht:</strong> Sie können nach vorheriger Terminvereinbarung Einsicht in sämtliche
      Abrechnungsunterlagen nehmen (§ 259 BGB). Auf Wunsch stellen wir gegen Kostenerstattung Kopien zur Verfügung.</li>
      <li><strong>Einwendungen:</strong> Einwendungen gegen diese Abrechnung müssen Sie uns spätestens bis zum
      <strong>${dt(einwendungsfrist)}</strong> mitteilen, also innerhalb von zwölf Monaten nach Zugang
      (§ 556 Abs. 3 Satz 5 und 6 BGB). Danach können Sie Einwendungen nur noch geltend machen, wenn Sie die
      verspätete Geltendmachung nicht zu vertreten haben.</li>
      <li><strong>Wirtschaftlichkeit:</strong> Bei der Bewirtschaftung des Objekts wurde der Grundsatz der
      Wirtschaftlichkeit beachtet (§ 556 Abs. 3 Satz 1 BGB).</li>
      <li><strong>Umlagefähigkeit:</strong> Umgelegt wurden ausschließlich Betriebskosten im Sinne des § 2 BetrKV,
      die nach dem Mietvertrag auf Sie umzulegen sind. Verwaltungskosten sowie Kosten der Instandhaltung und
      Instandsetzung sind nicht enthalten (§ 1 Abs. 2 BetrKV).</li>
      <li><strong>Anpassung der Vorauszahlungen:</strong> Beide Vertragsparteien können nach dieser Abrechnung eine
      Anpassung der monatlichen Vorauszahlungen auf eine angemessene Höhe verlangen (§ 560 Abs. 4 BGB).</li>
    </ul>
  </div>`;
}

function fussnote() {
  return `
  <div class="dok-fuss">
    Erstellt mit der Nebenkosten-App. Grundlagen: §§ 556, 556a, 560 BGB · Betriebskostenverordnung (BetrKV) ·
    Heizkostenverordnung (HeizkostenV) · Kohlendioxidkostenaufteilungsgesetz (CO2KostAufG) · § 35a EStG.
  </div>`;
}

/* ------------------------------------------------------------------------ */
/*  Interne Vermieterübersicht: Trennung umlagefähig / nicht umlagefähig     */
/* ------------------------------------------------------------------------ */

export function vermieterUebersicht(daten, periode, ergebnis) {
  // Nach der Nummerierung des § 2 BetrKV sortieren, damit die Übersicht der
  // Reihenfolge im Katalog und in den Mieterabrechnungen folgt.
  const u = [...ergebnis.positionenUmlagefaehig].sort(
    (a, b) => (kostenart(a.kostenartId)?.nr ?? 99) - (kostenart(b.kostenartId)?.nr ?? 99)
  );
  const n = ergebnis.positionenNichtUmlagefaehig;

  const zeileU = (p) => {
    const netto = Math.max(0, (p.betragBrutto || 0) - (p.abzugBetrag || 0));
    const art = kostenart(p.kostenartId);
    return `<tr>
      <td>${art?.nr ? `${art.nr}. ` : ''}${esc(p.bezeichnung || art?.bezeichnung || p.kostenartId)}
        <span class="klein">${esc(art?.rechtsgrundlage || '')}</span></td>
      <td class="z">${euro(p.betragBrutto || 0)}</td>
      <td class="z">${p.abzugBetrag ? `− ${euro(p.abzugBetrag)}` : '–'}</td>
      <td class="z"><strong>${euro(netto)}</strong></td>
      <td>${esc(SCHLUESSEL_INFO[p.schluessel]?.kurz || p.schluessel)}</td>
    </tr>`;
  };

  const zeileN = (p) => {
    const art = kostenart(p.kostenartId);
    return `<tr>
      <td>${esc(p.bezeichnung || art?.bezeichnung || p.kostenartId)}
        <span class="klein">${esc(art?.grund || 'Keine Betriebskosten im Sinne des § 2 BetrKV')}</span></td>
      <td class="z">${euro(p.betragBrutto || 0)}</td>
      <td>${esc(art?.rechtsgrundlage || '')}</td>
    </tr>`;
  };

  const abzuege = u.filter((p) => (p.abzugBetrag || 0) > 0);

  return `
<div class="blatt">
  <h1>Interne Kostenübersicht ${esc(String(periode.jahr || ''))}</h1>
  <p>${esc(daten.objekt.bezeichnung || '')} · ${esc(daten.objekt.strasse || '')}, ${esc(daten.objekt.plz || '')} ${esc(
    daten.objekt.ort || ''
  )}<br>
  Abrechnungszeitraum ${dt(ergebnis.zeitraum.von)} – ${dt(ergebnis.zeitraum.bis)}
  <span style="color:#a00;font-weight:700"> · Nicht zur Weitergabe an Mieter bestimmt</span></p>

  <h2>A. Umlagefähige Betriebskosten (§ 2 BetrKV)</h2>
  <table class="dok">
    <thead><tr><th>Kostenart</th><th class="z">Rechnungsbetrag</th><th class="z">nicht umlagef. Abzug</th><th class="z">umlagefähig</th><th>Schlüssel</th></tr></thead>
    <tbody>${u.map(zeileU).join('')}</tbody>
    <tfoot>
      <tr class="summe">
        <td>Summe laufende Betriebskosten</td>
        <td class="z">${euro(summe(u.map((p) => p.betragBrutto || 0)))}</td>
        <td class="z">− ${euro(ergebnis.vermieter.abzuege)}</td>
        <td class="z">${euro(summe(u.map((p) => Math.max(0, (p.betragBrutto || 0) - (p.abzugBetrag || 0)))))}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  ${
    ergebnis.heizung
      ? `<h3>Heiz- und Warmwasserkosten (HeizkostenV)</h3>
  <table class="dok">
    <tbody>
      <tr><td>Kosten der Wärmeversorgung insgesamt</td><td class="z">${euro(ergebnis.heizung.kostenRoh.gesamt)}</td></tr>
      ${
        ergebnis.heizung.co2.vermieterCent > 0
          ? `<tr><td>./. CO₂-Kostenanteil des Vermieters (Stufe ${ergebnis.heizung.co2.stufe.stufe}, ${zahl(
              ergebnis.heizung.co2.anteilVermieter * 100,
              0
            )} %)</td><td class="z">− ${euro(ergebnis.heizung.co2.vermieterCent)}</td></tr>`
          : ''
      }
      <tr class="summe"><td>umlagefähig</td><td class="z">${euro(ergebnis.heizung.gesamtUmlagefaehig)}</td></tr>
    </tbody>
  </table>`
      : ''
  }

  <h2>B. Nicht umlagefähige Kosten – vom Vermieter zu tragen</h2>
  ${
    n.length
      ? `<table class="dok">
    <thead><tr><th>Position</th><th class="z">Betrag</th><th>Rechtsgrundlage</th></tr></thead>
    <tbody>${n.map(zeileN).join('')}</tbody>
    <tfoot><tr class="summe"><td>Summe</td><td class="z">${euro(ergebnis.vermieter.nichtUmlagefaehig)}</td><td></td></tr></tfoot>
  </table>`
      : '<p><em>Keine gesondert erfassten nicht umlagefähigen Kosten.</em></p>'
  }

  ${
    abzuege.length
      ? `<h3>Aus umlagefähigen Positionen herausgerechnete Anteile</h3>
  <table class="dok">
    <thead><tr><th>Position</th><th class="z">Abzug</th><th>Begründung</th></tr></thead>
    <tbody>${abzuege
      .map(
        (p) =>
          `<tr><td>${esc(p.bezeichnung || kostenart(p.kostenartId)?.bezeichnung || '')}</td><td class="z">${euro(
            p.abzugBetrag
          )}</td><td>${esc(p.abzugGrund || '')}</td></tr>`
      )
      .join('')}</tbody>
  </table>`
      : ''
  }

  <h2>C. Belastung des Vermieters</h2>
  <table class="dok">
    <tbody>
      <tr><td>Nicht umlagefähige Kosten</td><td class="z">${euro(ergebnis.vermieter.nichtUmlagefaehig)}</td></tr>
      <tr><td>Herausgerechnete Anteile umlagefähiger Positionen</td><td class="z">${euro(ergebnis.vermieter.abzuege)}</td></tr>
      <tr><td>Auf Leerstandszeiten entfallende Betriebskosten</td><td class="z">${euro(ergebnis.vermieter.leerstandsanteil)}</td></tr>
      ${
        ergebnis.vermieter.verbrauchsdifferenz > 0
          ? `<tr><td>Nicht umgelegte Zählerdifferenz (Allgemein- und Schwundwasser)</td><td class="z">${euro(
              ergebnis.vermieter.verbrauchsdifferenz
            )}</td></tr>`
          : ''
      }
      <tr><td>CO₂-Kostenanteil nach CO2KostAufG</td><td class="z">${euro(ergebnis.vermieter.co2Anteil)}</td></tr>
      ${
        ergebnis.vermieter.kuerzung15 > 0
          ? `<tr><td>Kürzung nach § 12 Abs. 1 HeizkostenV</td><td class="z">${euro(ergebnis.vermieter.kuerzung15)}</td></tr>`
          : ''
      }
      <tr class="summe"><td>Gesamtbelastung des Vermieters</td><td class="z">${euro(
        ergebnis.vermieter.gesamtbelastung + ergebnis.vermieter.kuerzung15
      )}</td></tr>
    </tbody>
  </table>

  <h2>D. Ergebnisse je Mietverhältnis</h2>
  <table class="dok">
    <thead><tr><th>Einheit</th><th>Mieter</th><th>Zeitraum</th><th class="z">Kosten</th><th class="z">Vorauszahlung</th><th class="z">Saldo</th></tr></thead>
    <tbody>
      ${ergebnis.ergebnisse
        .map(
          (e) => `<tr>
        <td>${esc(e.einheit?.bezeichnung || '')}</td>
        <td>${esc(e.mieterName)}</td>
        <td>${dt(e.nutzungVon)} – ${dt(e.nutzungBis)}</td>
        <td class="z">${euro(e.summeGesamt)}</td>
        <td class="z">${euro(e.vorauszahlungen.gesamt)}</td>
        <td class="z"><strong>${e.saldo > 0 ? '+' : ''}${euro(e.saldo)}</strong></td>
      </tr>`
        )
        .join('')}
    </tbody>
    <tfoot>
      <tr class="summe">
        <td colspan="3">Summe</td>
        <td class="z">${euro(summe(ergebnis.ergebnisse.map((e) => e.summeGesamt)))}</td>
        <td class="z">${euro(summe(ergebnis.ergebnisse.map((e) => e.vorauszahlungen.gesamt)))}</td>
        <td class="z">${euro(summe(ergebnis.ergebnisse.map((e) => e.saldo)))}</td>
      </tr>
    </tfoot>
  </table>
  <p style="font-size:8pt;color:#444;margin-top:3mm">
    Ein positiver Saldo bedeutet eine Nachforderung gegen den Mieter, ein negativer Saldo ein Guthaben des Mieters.
  </p>
</div>`;
}
