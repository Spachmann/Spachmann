/**
 * Dateien aus der App heraus speichern.
 *
 * Auf dem iPad führt der übliche Weg über ein `<a download>` nicht zum Ziel:
 * Safari kennt das Attribut zwar, öffnet aber keinen Dateidialog – und im
 * Vollbildmodus einer zum Home-Bildschirm hinzugefügten App passiert oft gar
 * nichts. Ein Speicherort lässt sich dort nur über das Teilen-Menü wählen
 * („In Dateien sichern"), also über die Web Share API mit Dateianhang.
 *
 * Umgekehrt ist auf dem Schreibtischrechner der Download der erwartete Weg.
 * Deshalb kennt dieses Modul beide und wählt die passende Reihenfolge; der
 * jeweils andere Weg bleibt als Rückfallebene erhalten.
 */

/** Kann dieser Browser die Datei über das System-Teilen-Menü weitergeben? */
export function kannTeilen(datei, nav = globalThis.navigator) {
  if (typeof nav?.share !== 'function') return false;
  // canShare fehlt in älteren Fassungen; dann bleibt nur der Versuch.
  if (typeof nav.canShare !== 'function') return true;
  try {
    return nav.canShare({ files: [datei] });
  } catch {
    return false;
  }
}

/**
 * Läuft die App auf einem Gerät, auf dem der Download keinen Dateidialog
 * öffnet? Das betrifft iPhone und iPad – iPadOS meldet sich dabei als
 * „MacIntel" und ist nur an den Touchpunkten zu erkennen.
 *
 * Die Erkennung bestimmt ausschließlich die Reihenfolge der beiden Wege.
 * Liegt sie falsch, bleibt der andere Weg trotzdem erreichbar.
 */
export function bevorzugtTeilen(nav = globalThis.navigator) {
  if (!nav) return false;
  const apfel = /iPad|iPhone|iPod/.test(nav.userAgent || '') ||
    (/Mac/.test(nav.platform || '') && (nav.maxTouchPoints || 0) > 1);
  const alsApp = nav.standalone === true ||
    (typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(display-mode: standalone)').matches);
  return apfel || alsApp;
}

/**
 * Speichert einen Blob unter dem gewünschten Namen.
 *
 * @returns {Promise<'geteilt'|'heruntergeladen'|'abgebrochen'|'gescheitert'>}
 */
export async function speichereDatei(blob, dateiname, { titel = '', nav = globalThis.navigator, dok = globalThis.document } = {}) {
  const datei = new File([blob], dateiname, { type: blob.type || 'application/octet-stream' });
  const wege = bevorzugtTeilen(nav) ? ['teilen', 'download'] : ['download', 'teilen'];

  for (const weg of wege) {
    if (weg === 'teilen') {
      if (!kannTeilen(datei, nav)) continue;
      try {
        await nav.share({ files: [datei], title: titel || dateiname });
        return 'geteilt';
      } catch (fehler) {
        // Der Abbruch durch den Benutzer ist kein Fehler – dann ist Schluss.
        if (fehler?.name === 'AbortError') return 'abgebrochen';
      }
    } else if (ladeHerunter(blob, dateiname, dok)) {
      return 'heruntergeladen';
    }
  }

  return 'gescheitert';
}

/** Klassischer Download über einen unsichtbaren Verweis. */
function ladeHerunter(blob, dateiname, dok = globalThis.document) {
  if (!dok?.createElement) return false;
  const a = dok.createElement('a');
  if (!('download' in a)) return false;

  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = dateiname;
  a.rel = 'noopener';
  dok.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

/**
 * Öffnet den Inhalt in einem neuen Tab. Letzter Ausweg, wenn weder Teilen noch
 * Download gehen: von dort lässt sich der Text zumindest markieren und über
 * das Teilen-Menü des Browsers sichern.
 */
export function oeffneInNeuemTab(blob, fenster = globalThis.window) {
  const url = URL.createObjectURL(blob);
  const neu = fenster.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return !!neu;
}
