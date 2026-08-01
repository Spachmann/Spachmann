import { useMemo, useRef, useState } from 'react';
import { berechneAbrechnung } from './domain/berechnung';
import { pruefeAbrechnung } from './domain/pruefung';
import { formatEuro } from './domain/util';
import { AbrechnungAnsicht } from './components/AbrechnungAnsicht';
import { HeizkostenForm } from './components/HeizkostenForm';
import { KostenForm } from './components/KostenForm';
import { MietverhaeltnisseForm } from './components/MietverhaeltnisseForm';
import { PruefungAnsicht } from './components/PruefungAnsicht';
import { StammdatenForm } from './components/StammdatenForm';
import { ZeitraumForm } from './components/ZeitraumForm';
import { Hinweisbox, Karte, Knopf } from './components/ui';
import { demoZustand } from './state/demo';
import { exportiereJson, importiereJson, useStore } from './state/store';

type Reiter =
  | 'stammdaten'
  | 'mietverhaeltnisse'
  | 'zeitraeume'
  | 'kosten'
  | 'heizkosten'
  | 'pruefung'
  | 'abrechnung';

const REITER: { id: Reiter; label: string }[] = [
  { id: 'stammdaten', label: '1 · Objekt & Vermieter' },
  { id: 'zeitraeume', label: '2 · Abrechnungszeitraum' },
  { id: 'mietverhaeltnisse', label: '3 · Mietverhältnisse' },
  { id: 'kosten', label: '4 · Kosten' },
  { id: 'heizkosten', label: '5 · Heizkosten & Verbrauch' },
  { id: 'pruefung', label: '6 · Prüfung' },
  { id: 'abrechnung', label: '7 · Abrechnung' },
];

export default function App() {
  const { state, update, ersetze, zuruecksetzen } = useStore();
  const [reiter, setReiter] = useState<Reiter>('stammdaten');
  const [meldung, setMeldung] = useState<string | null>(null);
  const dateiFeld = useRef<HTMLInputElement>(null);

  const zeitraum = state.abrechnungszeitraeume.find((z) => z.id === state.aktiverZeitraumId);

  const ergebnis = useMemo(
    () => (zeitraum ? berechneAbrechnung(state, zeitraum) : undefined),
    [state, zeitraum],
  );
  const bericht = useMemo(
    () => (zeitraum && ergebnis ? pruefeAbrechnung(state, zeitraum, ergebnis) : undefined),
    [state, zeitraum, ergebnis],
  );

  const exportiere = () => {
    const blob = new Blob([exportiereJson(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nebenkosten-${state.objekt.bezeichnung || 'objekt'}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importiere = async (datei: File) => {
    try {
      ersetze(importiereJson(await datei.text()));
      setMeldung('Daten wurden importiert.');
    } catch (fehler) {
      setMeldung(`Import fehlgeschlagen: ${(fehler as Error).message}`);
    }
  };

  return (
    <div className="app">
      <header className="kopfzeile">
        <div>
          <h1>Nebenkostenabrechnung</h1>
          <p>
            Betriebskostenabrechnung nach § 556 BGB, Betriebskostenverordnung und
            Heizkostenverordnung
          </p>
        </div>
        <div className="kopf-aktionen">
          <select
            value={state.aktiverZeitraumId ?? ''}
            onChange={(e) => update((s) => ({ ...s, aktiverZeitraumId: e.target.value }))}
          >
            {state.abrechnungszeitraeume.map((z) => (
              <option key={z.id} value={z.id}>
                {z.bezeichnung}
              </option>
            ))}
          </select>
          <Knopf onClick={exportiere}>Exportieren</Knopf>
          <Knopf onClick={() => dateiFeld.current?.click()}>Importieren</Knopf>
          <input
            ref={dateiFeld}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const datei = e.target.files?.[0];
              if (datei) void importiere(datei);
              e.target.value = '';
            }}
          />
          <Knopf
            onClick={() => {
              ersetze(demoZustand());
              setMeldung('Beispieldaten geladen.');
            }}
          >
            Beispiel laden
          </Knopf>
          <Knopf
            art="gefahr"
            onClick={() => {
              if (confirm('Alle erfassten Daten unwiderruflich löschen?')) {
                zuruecksetzen();
                setMeldung('Alle Daten wurden gelöscht.');
              }
            }}
          >
            Zurücksetzen
          </Knopf>
        </div>
      </header>

      <nav className="reiter">
        {REITER.map((r) => (
          <button
            key={r.id}
            className={`reiter-knopf${reiter === r.id ? ' aktiv' : ''}`}
            onClick={() => setReiter(r.id)}
          >
            {r.label}
            {r.id === 'pruefung' && bericht && bericht.anzahlFehler > 0 && (
              <span className="abzeichen">{bericht.anzahlFehler}</span>
            )}
          </button>
        ))}
      </nav>

      {meldung && (
        <div className="meldung" onClick={() => setMeldung(null)}>
          {meldung} <span className="schliessen">×</span>
        </div>
      )}

      <main>
        {reiter === 'stammdaten' && <StammdatenForm />}
        {reiter === 'zeitraeume' && <ZeitraumForm />}
        {reiter === 'mietverhaeltnisse' && <MietverhaeltnisseForm />}
        {reiter === 'kosten' && <KostenForm />}
        {reiter === 'heizkosten' && <HeizkostenForm />}
        {reiter === 'pruefung' &&
          (bericht && ergebnis ? (
            <PruefungAnsicht bericht={bericht} ergebnis={ergebnis} />
          ) : (
            <Karte>
              <Hinweisbox art="warnung" titel="Kein Abrechnungszeitraum gewählt">
                Wählen Sie oben einen Abrechnungszeitraum aus.
              </Hinweisbox>
            </Karte>
          ))}
        {reiter === 'abrechnung' &&
          (zeitraum && ergebnis ? (
            <AbrechnungAnsicht state={state} zeitraum={zeitraum} ergebnis={ergebnis} />
          ) : (
            <Karte>
              <Hinweisbox art="warnung" titel="Kein Abrechnungszeitraum gewählt">
                Wählen Sie oben einen Abrechnungszeitraum aus.
              </Hinweisbox>
            </Karte>
          ))}
      </main>

      <footer className="fusszeile">
        <div>
          {ergebnis && (
            <>
              Umlagefähig: <strong>{formatEuro(ergebnis.gesamtkostenUmlagefaehig)}</strong> · Nicht
              umlagefähig: <strong>{formatEuro(ergebnis.gesamtkostenNichtUmlagefaehig)}</strong> ·
              Mietverhältnisse: <strong>{ergebnis.mieterAbrechnungen.length}</strong>
            </>
          )}
        </div>
        <div className="rechtshinweis">
          Alle Daten werden ausschließlich lokal im Browser gespeichert. Diese Anwendung ersetzt keine
          Rechtsberatung.
        </div>
      </footer>
    </div>
  );
}
