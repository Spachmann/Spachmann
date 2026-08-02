/**
 * Anwendungsgerüst: Navigation, Datenbindung und Aktionen.
 *
 * Der Bestand kann mehrere Vermieter mit je mehreren Objekten enthalten.
 * Gearbeitet wird immer auf einem ausgewählten Objekt und einem seiner
 * Abrechnungszeiträume; die Rechenkerne bekommen den passenden Ausschnitt.
 */

import * as store from './store.js';
import { $, esc, melde, frage, setzePfad } from './ui/dom.js';
import { parseBetrag, parseZahl } from './core/money.js';
import { heute } from './core/datum.js';
import { berechneAbrechnung } from './core/abrechnung.js';
import { pruefe } from './core/pruefung.js';
import { neuePosition, id, einheitenVon, objekteVon } from './core/model.js';
import { BETRIEBSKOSTEN, kostenart } from './core/katalog.js';
import { EMISSIONSFAKTOR } from './core/co2.js';
import { HEIZWERT } from './core/heizkosten.js';
import {
  startAnsicht, vermieterAnsicht, objekteAnsicht, einheitenAnsicht, mieterAnsicht,
  kostenAnsicht, heizungAnsicht, verbrauchAnsicht, pruefungAnsicht,
  abrechnungAnsicht, datenAnsicht,
} from './ui/views.js';

const ANSICHTEN = [
  { id: 'start', titel: 'Übersicht', icon: '🏠', gruppe: 'Abrechnung', render: startAnsicht },
  { id: 'kosten', titel: 'Kosten', icon: '🧾', gruppe: 'Abrechnung', render: kostenAnsicht },
  { id: 'heizung', titel: 'Heizung & Warmwasser', icon: '🔥', gruppe: 'Abrechnung', render: heizungAnsicht },
  { id: 'verbrauch', titel: 'Verbräuche', icon: '💧', gruppe: 'Abrechnung', render: verbrauchAnsicht },
  { id: 'pruefung', titel: 'Rechtsprüfung', icon: '⚖️', gruppe: 'Abrechnung', render: pruefungAnsicht },
  { id: 'abrechnung', titel: 'Dokument', icon: '📄', gruppe: 'Abrechnung', render: abrechnungAnsicht },
  { id: 'vermieter', titel: 'Vermieter', icon: '👤', gruppe: 'Stammdaten', render: vermieterAnsicht },
  { id: 'objekte', titel: 'Objekte', icon: '🏢', gruppe: 'Stammdaten', render: objekteAnsicht },
  { id: 'einheiten', titel: 'Wohneinheiten', icon: '🚪', gruppe: 'Stammdaten', render: einheitenAnsicht },
  { id: 'mieter', titel: 'Mietverhältnisse', icon: '👥', gruppe: 'Stammdaten', render: mieterAnsicht },
  { id: 'daten', titel: 'Daten & Sicherung', icon: '💾', gruppe: 'Stammdaten', render: datenAnsicht },
];

const zustand = {
  ansicht: 'start',
  dokumentAuswahl: 'alle',
};

/* --------------------------------------------------------------- Kontext */

function baueKontext() {
  const daten = store.hole();
  const bestand = store.bestand();
  const periode = store.aktiveAbrechnung();
  const zeitraeume = store.zeitraeume();
  let ergebnis = null;
  let pruefergebnis = null;

  if (bestand && periode && bestand.einheiten.length) {
    try {
      ergebnis = berechneAbrechnung(bestand, periode);
      pruefergebnis = pruefe(bestand, periode, ergebnis);
    } catch (fehler) {
      console.error('Berechnung fehlgeschlagen:', fehler);
    }
  }

  return { daten, bestand, periode, zeitraeume, ergebnis, pruefergebnis, dokumentAuswahl: zustand.dokumentAuswahl };
}

/* --------------------------------------------------------------- Rendern */

function render() {
  const ctx = baueKontext();
  const ansicht = ANSICHTEN.find((a) => a.id === zustand.ansicht) || ANSICHTEN[0];

  const scroll = window.scrollY;
  const aktiv = document.activeElement;
  const fokusZiel = aktiv?.dataset?.ziel;
  const fokusFeld = aktiv?.dataset?.feld;

  $('#seitenleiste').innerHTML = navigation(ctx);
  $('#inhalt').innerHTML = ansicht.render(ctx);

  if (fokusZiel && fokusFeld) {
    const neu = $(`[data-ziel="${CSS.escape(fokusZiel)}"][data-feld="${CSS.escape(fokusFeld)}"]`);
    if (neu) neu.focus({ preventScroll: true });
  }
  window.scrollTo({ top: scroll });
}

function navigation(ctx) {
  const { daten, bestand, periode, zeitraeume, pruefergebnis } = ctx;

  const gruppen = new Map();
  for (const a of ANSICHTEN) {
    if (!gruppen.has(a.gruppe)) gruppen.set(a.gruppe, []);
    gruppen.get(a.gruppe).push(a);
  }

  const zaehler = {
    kosten: periode?.positionen.length || 0,
    einheiten: bestand?.einheiten.length || 0,
    mieter: bestand?.mietverhaeltnisse.length || 0,
    objekte: daten.objekte.length,
    vermieter: daten.vermieter.length,
  };

  const punkte = [...gruppen.entries()]
    .map(
      ([gruppe, eintraege]) => `<div class="nav-gruppe">
      <div class="nav-titel">${esc(gruppe)}</div>
      ${eintraege
        .map((a) => {
          let abzeichen = '';
          if (a.id === 'pruefung' && pruefergebnis) {
            const n = pruefergebnis.fehler;
            abzeichen = `<span class="zaehler ${n ? 'warn' : ''}">${n || '✓'}</span>`;
          } else if (zaehler[a.id]) {
            abzeichen = `<span class="zaehler">${zaehler[a.id]}</span>`;
          }
          return `<button class="nav-punkt" data-aktion="gehe-zu" data-wert="${a.id}"
            ${zustand.ansicht === a.id ? 'aria-current="page"' : ''}>
            <span class="icon">${a.icon}</span><span>${esc(a.titel)}</span>${abzeichen}
          </button>`;
        })
        .join('')}
    </div>`
    )
    .join('');

  // Objektauswahl, nach Vermieter gruppiert
  const objektWahl = daten.objekte.length
    ? `<div class="nav-gruppe">
      <div class="nav-titel">Objekt</div>
      <select data-aktion="objekt-waehlen-select" style="font-size:15px">
        ${daten.vermieter
          .map((v) => {
            const eigene = objekteVon(daten, v.id);
            if (!eigene.length) return '';
            return `<optgroup label="${esc(v.name || 'Ohne Namen')}">${eigene
              .map(
                (o) =>
                  `<option value="${esc(o.id)}"${bestand?.objekt.id === o.id ? ' selected' : ''}>${esc(
                    o.bezeichnung || o.strasse || 'Objekt'
                  )}</option>`
              )
              .join('')}</optgroup>`;
          })
          .join('')}
      </select>
    </div>`
    : '';

  const jahrWahl = zeitraeume.length
    ? `<div class="nav-gruppe">
      <div class="nav-titel">Abrechnungsjahr</div>
      <select data-aktion="jahr-waehlen" style="font-size:15px">
        ${zeitraeume
          .map((a) => `<option value="${esc(a.id)}"${periode?.id === a.id ? ' selected' : ''}>${a.jahr}</option>`)
          .join('')}
      </select>
    </div>`
    : '';

  return `
    <div class="marke">
      <div class="marke-zeichen">NK</div>
      <div class="marke-text">Nebenkosten<small>Abrechnung nach BetrKV</small></div>
    </div>
    ${objektWahl}
    ${jahrWahl}
    ${punkte}`;
}

/* -------------------------------------------------------------- Bindung */

/** Löst data-ziel in das zu ändernde Objekt auf. */
function zielObjekt(ziel) {
  const daten = store.hole();
  const periode = store.aktiveAbrechnung();
  const [art, schluessel] = ziel.split(':');

  switch (art) {
    case 'vermieter': return daten.vermieter.find((v) => v.id === schluessel);
    case 'objekt': return daten.objekte.find((o) => o.id === schluessel);
    case 'periode': return periode;
    case 'heizung': return periode?.heizung;
    case 'ansicht': return zustand;
    case 'einheit': return daten.einheiten.find((e) => e.id === schluessel);
    case 'mv': return daten.mietverhaeltnisse.find((m) => m.id === schluessel);
    case 'position': return periode?.positionen.find((p) => p.id === schluessel);
    default: return null;
  }
}

function wandle(rohwert, typ) {
  switch (typ) {
    case 'betrag': return parseBetrag(rohwert);
    case 'zahl': return parseZahl(rohwert);
    case 'int': return Math.round(parseZahl(rohwert));
    case 'prozent': return parseZahl(rohwert) / 100;
    case 'bool': return !!rohwert;
    default: return rohwert;
  }
}

function uebernehmeFeld(el, neuRendern) {
  const ziel = el.dataset.ziel;
  const feld = el.dataset.feld;
  const typ = el.dataset.typ || 'text';
  const objekt = zielObjekt(ziel);
  if (!objekt) return;

  const roh = typ === 'bool' ? el.checked : el.value;
  const wert = wandle(roh, typ);

  const anwenden = (daten) => {
    setzePfad(objekt, feld, wert);
    nachbereite(ziel, feld, objekt, daten);
  };

  if (ziel === 'ansicht') {
    zustand[feld] = wert;
    render();
    return;
  }

  if (neuRendern) store.aendere(anwenden);
  else store.aendereStill(anwenden);
}

/** Folgeänderungen, die sich aus einer Eingabe ergeben. */
function nachbereite(ziel, feld, objekt, daten) {
  // Jahr aus dem Abrechnungsbeginn ableiten
  if (ziel === 'periode' && (feld === 'von' || feld === 'bis') && objekt?.von) {
    objekt.jahr = Number(String(objekt.von).slice(0, 4));
  }

  // Kostenart gewechselt: Standardschlüssel und Umlagefähigkeit nachziehen
  if (ziel.startsWith('position:') && feld === 'kostenartId') {
    const art = kostenart(objekt.kostenartId);
    const istKatalog = BETRIEBSKOSTEN.some((k) => k.id === objekt.kostenartId);
    if (art && istKatalog) {
      objekt.schluessel = art.schluessel;
      objekt.umlagefaehig = true;
    } else {
      objekt.umlagefaehig = false;
    }
  }

  // Gesamtwohnfläche des Objekts vorbelegen, solange keine erfasst ist
  if (ziel.startsWith('einheit:') && feld === 'wohnflaeche') {
    const eigenesObjekt = daten.objekte.find((o) => o.id === objekt.objektId);
    if (eigenesObjekt && !eigenesObjekt.wohnflaecheGesamt) {
      eigenesObjekt.wohnflaecheGesamt = einheitenVon(daten, eigenesObjekt.id)
        .reduce((s, e) => s + (e.wohnflaeche || 0), 0);
    }
  }
}

/* -------------------------------------------------------------- Aktionen */

const aktionen = {
  'gehe-zu'(el) {
    zustand.ansicht = el.dataset.wert;
    window.scrollTo({ top: 0 });
    render();
  },

  'jahr-waehlen'(el) {
    store.setzeAktiveAbrechnung(el.value);
  },

  'objekt-waehlen-select'(el) {
    store.setzeAktivesObjekt(el.value);
  },

  'objekt-waehlen'(el) {
    store.setzeAktivesObjekt(el.dataset.id);
    melde('Objekt gewechselt');
  },

  // ------------------------------------------------------------ Vermieter

  'vermieter-neu'() {
    store.legeVermieterAn();
    zustand.ansicht = 'vermieter';
    render();
    melde('Vermieter angelegt');
  },

  'vermieter-loeschen'(el) {
    const daten = store.hole();
    const v = daten.vermieter.find((x) => x.id === el.dataset.id);
    const eigene = objekteVon(daten, el.dataset.id);
    if (
      !frage(
        `„${v?.name || 'Vermieter'}" löschen?` +
          (eigene.length
            ? ` ${eigene.length} Objekt(e) mit allen Einheiten, Mietverhältnissen und Abrechnungen werden ebenfalls entfernt.`
            : '')
      )
    ) return;
    store.loescheVermieter(el.dataset.id);
  },

  // -------------------------------------------------------------- Objekte

  'objekt-neu'() {
    const daten = store.hole();
    if (!daten.vermieter.length) {
      zustand.ansicht = 'vermieter';
      render();
      return melde('Bitte zuerst einen Vermieter anlegen');
    }
    const aktiv = store.aktivesObjekt();
    store.legeObjektAn(aktiv?.vermieterId || daten.vermieter[0].id);
    zustand.ansicht = 'objekte';
    render();
    melde('Objekt angelegt');
  },

  'objekt-loeschen'(el) {
    const daten = store.hole();
    const o = daten.objekte.find((x) => x.id === el.dataset.id);
    const anzahl = einheitenVon(daten, el.dataset.id).length;
    if (
      !frage(
        `„${o?.bezeichnung || 'Objekt'}" löschen?` +
          (anzahl ? ` ${anzahl} Einheit(en) samt Mietverhältnissen und Abrechnungen werden ebenfalls entfernt.` : '')
      )
    ) return;
    store.loescheObjekt(el.dataset.id);
  },

  'flaeche-uebernehmen'(el) {
    const objektId = el.dataset.id || store.aktivesObjekt()?.id;
    if (!objektId) return;
    store.aendere((daten) => {
      const o = daten.objekte.find((x) => x.id === objektId);
      if (o) o.wohnflaecheGesamt = einheitenVon(daten, objektId).reduce((s, e) => s + (e.wohnflaeche || 0), 0);
    });
    melde('Gesamtwohnfläche übernommen');
  },

  // ------------------------------------------------------------ Einheiten

  'einheit-neu'() {
    if (!store.aktivesObjekt()) return melde('Bitte zuerst ein Objekt anlegen');
    store.legeEinheitAn();
    melde('Einheit angelegt');
  },

  'einheit-loeschen'(el) {
    const daten = store.hole();
    const einheit = daten.einheiten.find((e) => e.id === el.dataset.id);
    const betroffen = daten.mietverhaeltnisse.filter((m) => m.einheitId === el.dataset.id).length;
    if (!frage(`„${einheit?.bezeichnung}" löschen?${betroffen ? ` ${betroffen} Mietverhältnis(se) werden ebenfalls entfernt.` : ''}`)) return;
    store.loescheEinheit(el.dataset.id);
  },

  // ------------------------------------------------------ Mietverhältnisse

  'mv-neu'() {
    if (!store.einheiten().length) return melde('Bitte zuerst eine Einheit anlegen');
    store.legeMietverhaeltnisAn();
    melde('Mietverhältnis angelegt');
  },

  'mv-loeschen'(el) {
    const m = store.hole().mietverhaeltnisse.find((x) => x.id === el.dataset.id);
    if (!frage(`Mietverhältnis „${m?.mieterName || ''}" löschen?`)) return;
    store.loescheMietverhaeltnis(el.dataset.id);
  },

  // --------------------------------------------------------------- Kosten

  'position-neu'() {
    const periode = store.aktiveAbrechnung();
    if (!periode) return melde('Bitte zuerst einen Abrechnungszeitraum anlegen');
    store.aendere(() => periode.positionen.push(neuePosition()));
    melde('Position angelegt');
  },

  'position-loeschen'(el) {
    const periode = store.aktiveAbrechnung();
    const p = periode?.positionen.find((x) => x.id === el.dataset.id);
    if (!frage(`Position „${p?.bezeichnung || kostenart(p?.kostenartId)?.bezeichnung || ''}" löschen?`)) return;
    store.aendere(() => {
      periode.positionen = periode.positionen.filter((x) => x.id !== el.dataset.id);
    });
  },

  'verbrauch-setzen'(el) {
    const periode = store.aktiveAbrechnung();
    if (!periode) return;
    const einheitId = el.dataset.einheit;
    const mvId = el.dataset.mv || null;
    const art = el.dataset.art;
    const wert = parseZahl(el.value);

    store.aendereStill(() => {
      const vorhanden = periode.verbraeuche.find(
        (v) => v.einheitId === einheitId && v.mietverhaeltnisId === mvId && v.art === art
      );
      if (vorhanden) vorhanden.wert = wert;
      else periode.verbraeuche.push({ id: id('v'), einheitId, mietverhaeltnisId: mvId, art, wert });
    });
  },

  'co2-schaetzen'() {
    const periode = store.aktiveAbrechnung();
    if (!periode) return;
    const h = periode.heizung;
    const kwh = (h.brennstoffmenge || 0) * (HEIZWERT[h.brennstoff]?.wert || 0);
    const kg = kwh * (EMISSIONSFAKTOR[h.brennstoff] || 0);
    if (!kg) return melde('Brennstoffmenge fehlt');
    store.aendere(() => {
      h.co2.emissionKg = Math.round(kg);
    });
    melde('CO₂-Menge geschätzt – Wert der Rechnung hat Vorrang');
  },

  // ------------------------------------------------- Abrechnungszeiträume

  'abrechnung-neu'() {
    if (!store.aktivesObjekt()) return melde('Bitte zuerst ein Objekt anlegen');
    const jahre = store.zeitraeume().map((a) => a.jahr);
    const vorschlag = jahre.length ? Math.max(...jahre) + 1 : new Date().getFullYear() - 1;
    const eingabe = window.prompt('Für welches Jahr soll abgerechnet werden?', String(vorschlag));
    if (!eingabe) return;
    const jahr = Number.parseInt(eingabe, 10);
    if (!Number.isFinite(jahr) || jahr < 1990 || jahr > 2100) return melde('Ungültiges Jahr');
    store.legeAbrechnungAn(jahr);
    melde(`Abrechnungszeitraum ${jahr} angelegt`);
  },

  'abrechnung-waehlen'(el) {
    store.setzeAktiveAbrechnung(el.dataset.id);
    melde('Zeitraum ausgewählt');
  },

  'abrechnung-loeschen'(el) {
    const a = store.hole().abrechnungen.find((x) => x.id === el.dataset.id);
    if (!frage(`Abrechnung ${a?.jahr} mit allen Kosten löschen?`)) return;
    store.loescheAbrechnung(el.dataset.id);
  },

  // ---------------------------------------------------------------- Daten

  'demo-laden'() {
    if (!frage('Beispieldaten laden? Die aktuell gespeicherten Daten werden überschrieben.')) return;
    store.ladeDemodaten();
    zustand.ansicht = 'start';
    render();
    melde('Beispieldaten geladen');
  },

  'zuruecksetzen'() {
    if (!frage('Wirklich alle Daten unwiderruflich löschen?')) return;
    if (!frage('Diese Aktion kann nicht rückgängig gemacht werden. Fortfahren?')) return;
    store.setzeZurueck();
    zustand.ansicht = 'start';
    render();
    melde('Alle Daten gelöscht');
  },

  export() {
    const blob = store.sicherungBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nebenkosten-sicherung-${heute()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    melde('Sicherung erstellt');
  },

  async import(el) {
    const datei = el.files?.[0];
    if (!datei) return;
    try {
      await store.stelleWiederHer(datei);
      zustand.ansicht = 'start';
      render();
      melde('Sicherung geladen');
    } catch (fehler) {
      window.alert(`Die Sicherung konnte nicht gelesen werden.\n\n${fehler.message}`);
    } finally {
      el.value = '';
    }
  },

  drucken() {
    window.print();
  },
};

/* ------------------------------------------------------------- Ereignisse */

function findeAktion(ziel) {
  const el = ziel.closest('[data-aktion]');
  return el ? { el, name: el.dataset.aktion } : null;
}

document.addEventListener('click', (ev) => {
  const treffer = findeAktion(ev.target);
  if (!treffer) return;
  const { el, name } = treffer;
  // Formularelemente lösen über change/input aus, nicht über click.
  if (el.matches('select, input')) return;
  const fn = aktionen[name];
  if (fn) {
    ev.preventDefault();
    fn(el);
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  const treffer = findeAktion(el);
  if (treffer && el.matches('select, input')) {
    const fn = aktionen[treffer.name];
    if (fn) {
      fn(el);
      return;
    }
  }
  if (el.dataset?.feld) uebernehmeFeld(el, true);
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  // Beim Tippen still speichern, damit der Fokus erhalten bleibt.
  if (el.dataset?.feld && el.matches('input[type="text"], textarea')) {
    uebernehmeFeld(el, false);
  }
});

/* ------------------------------------------------------------------ Start */

store.lade();
store.abonniere(() => render());
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((fehler) => console.warn('Service Worker:', fehler));
  });
}
