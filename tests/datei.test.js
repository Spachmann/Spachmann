import test from 'node:test';
import assert from 'node:assert/strict';

import { kannTeilen, bevorzugtTeilen, speichereDatei } from '../src/ui/datei.js';

/* Der Test läuft in Node, deshalb werden Browser-Bausteine nachgebildet. */

const blob = () => new Blob(['{"a":1}'], { type: 'application/json' });

/** Nachbau eines `<a>`, das den Download meldet statt ihn auszuführen. */
function dokumentAttrappe({ kannDownload = true } = {}) {
  const geklickt = [];
  return {
    geklickt,
    body: { appendChild() {} },
    createElement() {
      const a = { rel: '', remove() {}, click() { geklickt.push({ href: a.href, name: a.download }); } };
      if (kannDownload) a.download = '';
      return a;
    },
  };
}

const navIPad = (extra = {}) => ({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
  ...extra,
});

const navRechner = (extra = {}) => ({
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120',
  platform: 'Linux x86_64',
  maxTouchPoints: 0,
  ...extra,
});

// --------------------------------------------------------------- Erkennung

test('iPad wird trotz Kennung „MacIntel" erkannt', () => {
  assert.equal(bevorzugtTeilen(navIPad()), true);
  assert.equal(bevorzugtTeilen({ userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 }), true);
});

test('ein Rechner ohne Touch bevorzugt den Download', () => {
  assert.equal(bevorzugtTeilen(navRechner()), false);
  // Ein Mac ohne Touchpunkte ist ein Rechner, kein iPad.
  assert.equal(bevorzugtTeilen({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 }), false);
});

test('eine zum Home-Bildschirm hinzugefügte App teilt ebenfalls', () => {
  assert.equal(bevorzugtTeilen({ ...navRechner(), standalone: true }), true);
});

test('kannTeilen achtet auf share und canShare', () => {
  const datei = new File([blob()], 'a.json', { type: 'application/json' });
  assert.equal(kannTeilen(datei, {}), false, 'ohne share');
  assert.equal(kannTeilen(datei, { share() {} }), true, 'ohne canShare bleibt der Versuch');
  assert.equal(kannTeilen(datei, { share() {}, canShare: () => false }), false, 'canShare lehnt Dateien ab');
  assert.equal(kannTeilen(datei, { share() {}, canShare: () => true }), true);
  // Wirft canShare, gilt Teilen als nicht möglich.
  assert.equal(kannTeilen(datei, { share() {}, canShare() { throw new Error('nope'); } }), false);
});

// ----------------------------------------------------------------- Wegwahl

test('auf dem iPad wird geteilt, nicht heruntergeladen', async () => {
  const geteilt = [];
  const nav = navIPad({
    canShare: () => true,
    share: async (d) => { geteilt.push(d); },
  });
  const dok = dokumentAttrappe();

  assert.equal(await speichereDatei(blob(), 'sicherung.json', { nav, dok }), 'geteilt');
  assert.equal(geteilt.length, 1);
  assert.equal(geteilt[0].files[0].name, 'sicherung.json');
  assert.equal(dok.geklickt.length, 0, 'kein Download nebenher');
});

test('am Rechner wird heruntergeladen, auch wenn Teilen ginge', async () => {
  const geteilt = [];
  const nav = navRechner({ canShare: () => true, share: async (d) => { geteilt.push(d); } });
  const dok = dokumentAttrappe();

  assert.equal(await speichereDatei(blob(), 'sicherung.json', { nav, dok }), 'heruntergeladen');
  assert.equal(dok.geklickt[0].name, 'sicherung.json');
  assert.equal(geteilt.length, 0);
});

test('kann das iPad nicht teilen, bleibt der Download als Rückfallebene', async () => {
  const dok = dokumentAttrappe();
  assert.equal(await speichereDatei(blob(), 'a.json', { nav: navIPad(), dok }), 'heruntergeladen');
  assert.equal(dok.geklickt.length, 1);
});

test('scheitert das Teilen mit einem Fehler, greift der Download', async () => {
  const nav = navIPad({ canShare: () => true, share: async () => { throw new Error('kaputt'); } });
  const dok = dokumentAttrappe();
  assert.equal(await speichereDatei(blob(), 'a.json', { nav, dok }), 'heruntergeladen');
  assert.equal(dok.geklickt.length, 1);
});

test('bricht der Benutzer das Teilen ab, wird nichts heruntergeladen', async () => {
  const abbruch = Object.assign(new Error('abgebrochen'), { name: 'AbortError' });
  const nav = navIPad({ canShare: () => true, share: async () => { throw abbruch; } });
  const dok = dokumentAttrappe();

  assert.equal(await speichereDatei(blob(), 'a.json', { nav, dok }), 'abgebrochen');
  assert.equal(dok.geklickt.length, 0, 'ein Abbruch ist eine Entscheidung, kein Fehler');
});

test('ohne jeden Weg wird das ehrlich gemeldet', async () => {
  const dok = dokumentAttrappe({ kannDownload: false });
  assert.equal(await speichereDatei(blob(), 'a.json', { nav: navIPad(), dok }), 'gescheitert');
});

test('die geteilte Datei trägt Namen und Inhalt der Sicherung', async () => {
  let uebergeben = null;
  const nav = navIPad({ canShare: () => true, share: async (d) => { uebergeben = d; } });

  await speichereDatei(blob(), 'nebenkosten-sicherung-2026-08-04.json', {
    titel: 'Sicherung der Nebenkostenabrechnung',
    nav,
    dok: dokumentAttrappe(),
  });

  const datei = uebergeben.files[0];
  assert.equal(datei.name, 'nebenkosten-sicherung-2026-08-04.json');
  assert.equal(datei.type, 'application/json');
  assert.equal(await datei.text(), '{"a":1}');
  assert.equal(uebergeben.title, 'Sicherung der Nebenkostenabrechnung');
});
