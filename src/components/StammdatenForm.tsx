import { useStore } from '../state/store';
import type { Einheit } from '../domain/types';
import { uuid } from '../domain/util';
import { formatZahl, summe } from '../domain/util';
import {
  Auswahl,
  Feld,
  Hinweisbox,
  Karte,
  Knopf,
  LeerZustand,
  Raster,
  Schalter,
  TextEingabe,
  ZahlEingabe,
} from './ui';

export function StammdatenForm() {
  const { state, update } = useStore();
  const objekt = state.objekt;
  const vermieter = objekt.vermieter;

  const setObjekt = (patch: Partial<typeof objekt>) =>
    update((s) => ({ ...s, objekt: { ...s.objekt, ...patch } }));
  const setVermieter = (patch: Partial<typeof vermieter>) =>
    update((s) => ({ ...s, objekt: { ...s.objekt, vermieter: { ...s.objekt.vermieter, ...patch } } }));

  const setEinheit = (id: string, patch: Partial<Einheit>) =>
    update((s) => ({
      ...s,
      einheiten: s.einheiten.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const neueEinheit = () =>
    update((s) => ({
      ...s,
      einheiten: [
        ...s.einheiten,
        {
          id: uuid(),
          objektId: s.objekt.id,
          bezeichnung: `Wohnung ${s.einheiten.length + 1}`,
          wohnflaecheQm: 0,
        },
      ],
    }));

  const loescheEinheit = (id: string) =>
    update((s) => ({
      ...s,
      einheiten: s.einheiten.filter((e) => e.id !== id),
      mietverhaeltnisse: s.mietverhaeltnisse.filter((m) => m.einheitId !== id),
    }));

  const gesamtflaeche = summe(state.einheiten.map((e) => e.wohnflaecheQm));

  return (
    <>
      <Karte
        titel="Vermieter"
        beschreibung="Die Abrechnung muss erkennen lassen, wer sie erteilt. Name und ladungsfähige Anschrift des Vermieters sind Pflichtangaben."
      >
        <Raster spalten={2}>
          <Feld label="Name / Firma">
            <TextEingabe wert={vermieter.name} onChange={(name) => setVermieter({ name })} />
          </Feld>
          <Feld label="Zusatz (optional)">
            <TextEingabe
              wert={vermieter.zusatz ?? ''}
              onChange={(zusatz) => setVermieter({ zusatz })}
              platzhalter="z. B. vertreten durch …"
            />
          </Feld>
          <Feld label="Straße und Hausnummer">
            <TextEingabe wert={vermieter.strasse} onChange={(strasse) => setVermieter({ strasse })} />
          </Feld>
          <Feld label="PLZ / Ort">
            <div className="zeile">
              <TextEingabe wert={vermieter.plz} onChange={(plz) => setVermieter({ plz })} platzhalter="PLZ" />
              <TextEingabe wert={vermieter.ort} onChange={(ort) => setVermieter({ ort })} platzhalter="Ort" />
            </div>
          </Feld>
          <Feld label="Telefon">
            <TextEingabe wert={vermieter.telefon ?? ''} onChange={(telefon) => setVermieter({ telefon })} />
          </Feld>
          <Feld label="E-Mail">
            <TextEingabe wert={vermieter.email ?? ''} onChange={(email) => setVermieter({ email })} typ="email" />
          </Feld>
        </Raster>

        <h3>Bankverbindung für Nachzahlung bzw. Guthabenerstattung</h3>
        <Raster spalten={2}>
          <Feld label="Kontoinhaber">
            <TextEingabe
              wert={vermieter.kontoinhaber ?? ''}
              onChange={(kontoinhaber) => setVermieter({ kontoinhaber })}
            />
          </Feld>
          <Feld label="Kreditinstitut">
            <TextEingabe
              wert={vermieter.kreditinstitut ?? ''}
              onChange={(kreditinstitut) => setVermieter({ kreditinstitut })}
            />
          </Feld>
          <Feld label="IBAN">
            <TextEingabe wert={vermieter.iban ?? ''} onChange={(iban) => setVermieter({ iban })} />
          </Feld>
          <Feld label="BIC">
            <TextEingabe wert={vermieter.bic ?? ''} onChange={(bic) => setVermieter({ bic })} />
          </Feld>
        </Raster>
      </Karte>

      <Karte titel="Objekt" beschreibung="Das abgerechnete Gebäude bildet die Abrechnungseinheit.">
        <Raster spalten={2}>
          <Feld label="Bezeichnung">
            <TextEingabe
              wert={objekt.bezeichnung}
              onChange={(bezeichnung) => setObjekt({ bezeichnung })}
              platzhalter="z. B. Mehrfamilienhaus Musterstraße 12"
            />
          </Feld>
          <Feld label="Straße und Hausnummer">
            <TextEingabe wert={objekt.strasse} onChange={(strasse) => setObjekt({ strasse })} />
          </Feld>
          <Feld label="PLZ / Ort">
            <div className="zeile">
              <TextEingabe wert={objekt.plz} onChange={(plz) => setObjekt({ plz })} platzhalter="PLZ" />
              <TextEingabe wert={objekt.ort} onChange={(ort) => setObjekt({ ort })} platzhalter="Ort" />
            </div>
          </Feld>
          <Feld
            label="Fiktive Personenzahl bei Leerstand"
            hinweis="Wird beim Personenschlüssel für leerstehende Wohnungen angesetzt, damit der Leerstandsanteil beim Vermieter verbleibt."
          >
            <ZahlEingabe
              wert={objekt.leerstandPersonenFiktiv}
              onChange={(leerstandPersonenFiktiv) => setObjekt({ leerstandPersonenFiktiv })}
              einheit="Personen"
            />
          </Feld>
        </Raster>
      </Karte>

      <Karte
        titel="Einheiten"
        beschreibung={
          <>
            Gesamtwohnfläche: <strong>{formatZahl(gesamtflaeche)} m²</strong> aus{' '}
            {state.einheiten.length} Einheit(en). Die Wohnfläche ist der gesetzliche Regelmaßstab
            (§ 556a Abs. 1 S. 1 BGB).
          </>
        }
        aktion={<Knopf art="primaer" onClick={neueEinheit}>+ Einheit</Knopf>}
      >
        {state.einheiten.length === 0 ? (
          <LeerZustand text="Noch keine Einheiten erfasst. Legen Sie für jede Wohnung bzw. Gewerbeeinheit einen Eintrag an." />
        ) : (
          <div className="liste">
            {state.einheiten.map((e) => (
              <div className="listeneintrag" key={e.id}>
                <Raster spalten={4}>
                  <Feld label="Bezeichnung">
                    <TextEingabe wert={e.bezeichnung} onChange={(bezeichnung) => setEinheit(e.id, { bezeichnung })} />
                  </Feld>
                  <Feld label="Wohnfläche">
                    <ZahlEingabe
                      wert={e.wohnflaecheQm}
                      onChange={(wohnflaecheQm) => setEinheit(e.id, { wohnflaecheQm })}
                      einheit="m²"
                    />
                  </Feld>
                  <Feld label="Lage">
                    <TextEingabe wert={e.lage ?? ''} onChange={(lage) => setEinheit(e.id, { lage })} />
                  </Feld>
                  <Feld label="Miteigentumsanteil" hinweis="nur bei WEG-Schlüssel">
                    <ZahlEingabe
                      wert={e.miteigentumsanteil ?? 0}
                      onChange={(miteigentumsanteil) => setEinheit(e.id, { miteigentumsanteil })}
                      einheit="MEA"
                    />
                  </Feld>
                </Raster>
                <div className="zeile zeile-abschluss">
                  <Schalter
                    wert={e.gewerbe ?? false}
                    onChange={(gewerbe) => setEinheit(e.id, { gewerbe })}
                    label="Gewerbeeinheit"
                    hinweis="Bei erheblicher Mehrbelastung ist ein Vorwegabzug erforderlich."
                  />
                  <Knopf art="gefahr" onClick={() => loescheEinheit(e.id)}>
                    Einheit löschen
                  </Knopf>
                </div>
              </div>
            ))}
          </div>
        )}
        {gesamtflaeche === 0 && state.einheiten.length > 0 && (
          <Hinweisbox art="warnung" titel="Wohnflächen fehlen">
            Ohne Wohnflächen kann der Regelmaßstab nicht gebildet werden.
          </Hinweisbox>
        )}
      </Karte>
    </>
  );
}

/** Auswahlfeld für Einheiten, in mehreren Formularen genutzt. */
export function EinheitAuswahl({
  wert,
  onChange,
  leerLabel = '– bitte wählen –',
}: {
  wert: string;
  onChange: (id: string) => void;
  leerLabel?: string;
}) {
  const { state } = useStore();
  return (
    <Auswahl
      wert={wert}
      onChange={onChange}
      optionen={[
        { wert: '', label: leerLabel },
        ...state.einheiten.map((e) => ({ wert: e.id, label: e.bezeichnung })),
      ]}
    />
  );
}
