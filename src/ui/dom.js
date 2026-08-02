/** Kleine Helfer für Templating und Formulare. */

/** Maskiert Text für die Einbettung in HTML. */
export function esc(wert) {
  if (wert === null || wert === undefined) return '';
  return String(wert)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tagged Template, das eingesetzte Werte automatisch maskiert. */
export function html(teile, ...werte) {
  return teile.reduce((acc, teil, i) => {
    if (i === 0) return teil;
    const w = werte[i - 1];
    const eingesetzt = Array.isArray(w) ? w.join('') : w instanceof Roh ? w.text : esc(w);
    return acc + eingesetzt + teil;
  }, '');
}

class Roh {
  constructor(text) {
    this.text = text ?? '';
  }
}

/** Markiert bereits erzeugtes HTML als sicher. */
export function roh(text) {
  return new Roh(text);
}

export function $(selektor, wurzel = document) {
  return wurzel.querySelector(selektor);
}

export function $$(selektor, wurzel = document) {
  return Array.from(wurzel.querySelectorAll(selektor));
}

/** Option-Liste für <select>. */
export function optionen(eintraege, aktiv) {
  return eintraege
    .map(([wert, text]) => `<option value="${esc(wert)}"${String(wert) === String(aktiv) ? ' selected' : ''}>${esc(text)}</option>`)
    .join('');
}

/** Kurzmeldung am unteren Bildschirmrand. */
let wolkenTimer = null;
export function melde(text) {
  let el = $('#wolke');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wolke';
    el.className = 'wolke';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('sichtbar');
  clearTimeout(wolkenTimer);
  wolkenTimer = setTimeout(() => el.classList.remove('sichtbar'), 2200);
}

/** Bestätigungsdialog. */
export function frage(text) {
  return window.confirm(text);
}

/**
 * Bindet Eingabefelder an ein Objekt.
 * Jedes Feld trägt data-pfad="feld.unterfeld" und data-typ="text|betrag|zahl|int|bool|prozent".
 */
export function lesePfad(objekt, pfad) {
  return pfad.split('.').reduce((o, k) => (o == null ? undefined : o[k]), objekt);
}

export function setzePfad(objekt, pfad, wert) {
  const teile = pfad.split('.');
  const letztes = teile.pop();
  const ziel = teile.reduce((o, k) => {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
    return o[k];
  }, objekt);
  ziel[letztes] = wert;
}
