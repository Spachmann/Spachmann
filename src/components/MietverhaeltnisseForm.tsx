import { useStore } from '../state/store';
import type { Mietverhaeltnis, PersonenzahlZeitraum } from '../domain/types';
import { formatDatum, formatEuro, tageInZeitraum, uuid } from '../domain/util';
import { EinheitAuswahl } from './StammdatenForm';
import {
  DatumEingabe,
  EuroEingabe,
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

export function MietverhaeltnisseForm() {
  const { state, update } = useStore();
  const zeitraum = state.abrechnungszeitraeume.find((z) => z.id === state.aktiverZeitraumId);

  const setMv = (id: string, patch: Partial<Mietverhaeltnis>) =>
    update((s) => ({
      ...s,
      mietverhaeltnisse: s.mietverhaeltnisse.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));

  const neu = () =>
    update((s) => ({
      ...s,
      mietverhaeltnisse: [
        ...s.mietverhaeltnisse,
        {
          id: uuid(),
          einheitId: s.einheiten[0]?.id ?? '',
          mieter: [''],
          beginn: zeitraum?.von ?? `${new Date().getFullYear()}-01-01`,
          personenzahlen: [
            {
              von: zeitraum?.von ?? `${new Date().getFullYear()}-01-01`,
              bis: '9999-12-31',
              anzahl: 1,
            },
          ],
          vorauszahlungBetriebskostenMonatlich: 0,
          vorauszahlungHeizkostenMonatlich: 0,
          umlageVereinbart: true,
          sonstigeBetriebskostenVereinbart: false,
        },
      ],
    }));

  const loesche = (id: string) =>
    update((s) => ({
      ...s,
      mietverhaeltnisse: s.mietverhaeltnisse.filter((m) => m.id !== id),
      verbraeuche: s.verbraeuche.filter((v) => v.mietverhaeltnisId !== id),
    }));

  const setPersonen = (mvId: string, index: number, patch: Partial<PersonenzahlZeitraum>) =>
    update((s) => ({
      ...s,
      mietverhaeltnisse: s.mietverhaeltnisse.map((m) =>
        m.id === mvId
          ? { ...m, personenzahlen: m.personenzahlen.map((p, i) => (i === index ? { ...p, ...patch } : p)) }
          : m,
      ),
    }));

  const neuerPersonenzeitraum = (mvId: string) =>
    update((s) => ({
      ...s,
      mietverhaeltnisse: s.mietverhaeltnisse.map((m) =>
        m.id === mvId
          ? {
              ...m,
              personenzahlen: [
                ...m.personenzahlen,
                { von: m.beginn, bis: m.ende ?? '9999-12-31', anzahl: 1 },
              ],
            }
          : m,
      ),
    }));

  const loeschePersonenzeitraum = (mvId: string, index: number) =>
    update((s) => ({
      ...s,
      mietverhaeltnisse: s.mietverhaeltnisse.map((m) =>
        m.id === mvId ? { ...m, personenzahlen: m.personenzahlen.filter((_, i) => i !== index) } : m,
      ),
    }));

  return (
    <Karte
      titel="Mietverhältnisse"
      beschreibung="Je Mietverhältnis wird eine eigene Abrechnung erstellt. Bei Mieterwechsel legen Sie für dieselbe Einheit zwei Mietverhältnisse mit den jeweiligen Zeiträumen an – die zeitabhängigen Kosten werden dann taggenau aufgeteilt."
      aktion={<Knopf art="primaer" onClick={neu}>+ Mietverhältnis</Knopf>}
    >
      {state.einheiten.length === 0 && (
        <Hinweisbox art="warnung" titel="Zuerst Einheiten anlegen">
          Ein Mietverhältnis muss einer Einheit zugeordnet werden.
        </Hinweisbox>
      )}

      {state.mietverhaeltnisse.length === 0 ? (
        <LeerZustand text="Noch keine Mietverhältnisse erfasst." />
      ) : (
        <div className="liste">
          {state.mietverhaeltnisse.map((m) => {
            const einheit = state.einheiten.find((e) => e.id === m.einheitId);
            const monatlich =
              m.vorauszahlungBetriebskostenMonatlich + m.vorauszahlungHeizkostenMonatlich;
            const tatsaechlich = zeitraum ? m.vorauszahlungenTatsaechlich?.[zeitraum.id] : undefined;

            return (
              <div className="listeneintrag" key={m.id}>
                <div className="eintrag-titel">
                  {m.mieter.filter(Boolean).join(', ') || 'Neues Mietverhältnis'}
                  {einheit && <span className="marke">{einheit.bezeichnung}</span>}
                  <span className="marke marke-leise">
                    {formatDatum(m.beginn)} – {m.ende ? formatDatum(m.ende) : 'laufend'}
                  </span>
                </div>

                <Raster spalten={3}>
                  <Feld label="Einheit">
                    <EinheitAuswahl wert={m.einheitId} onChange={(einheitId) => setMv(m.id, { einheitId })} />
                  </Feld>
                  <Feld label="Mietbeginn">
                    <DatumEingabe wert={m.beginn} onChange={(beginn) => setMv(m.id, { beginn })} />
                  </Feld>
                  <Feld label="Mietende" hinweis="leer lassen bei laufendem Mietverhältnis">
                    <DatumEingabe wert={m.ende ?? ''} onChange={(ende) => setMv(m.id, { ende: ende || undefined })} />
                  </Feld>
                </Raster>

                <Feld
                  label="Mieter (alle Vertragspartner, je Zeile eine Person)"
                  hinweis="Die Abrechnung muss an sämtliche Mieter des Mietvertrages gerichtet sein."
                  breit
                >
                  <textarea
                    rows={2}
                    value={m.mieter.join('\n')}
                    onChange={(e) => setMv(m.id, { mieter: e.target.value.split('\n') })}
                  />
                </Feld>

                <h4>Personenzahl im Haushalt</h4>
                <p className="beschreibung">
                  Wechselnde Personenzahlen werden über Personentage gewichtet. Erfassen Sie für jede
                  Änderung einen eigenen Zeitraum.
                </p>
                <div className="untertabelle">
                  {m.personenzahlen.map((p, i) => (
                    <div className="zeile" key={i}>
                      <Feld label="von">
                        <DatumEingabe wert={p.von} onChange={(von) => setPersonen(m.id, i, { von })} />
                      </Feld>
                      <Feld label="bis">
                        <DatumEingabe wert={p.bis} onChange={(bis) => setPersonen(m.id, i, { bis })} />
                      </Feld>
                      <Feld label="Personen">
                        <ZahlEingabe wert={p.anzahl} onChange={(anzahl) => setPersonen(m.id, i, { anzahl })} />
                      </Feld>
                      <Knopf art="leise" onClick={() => loeschePersonenzeitraum(m.id, i)}>
                        entfernen
                      </Knopf>
                    </div>
                  ))}
                  <Knopf art="leise" onClick={() => neuerPersonenzeitraum(m.id)}>
                    + Zeitraum
                  </Knopf>
                </div>

                <h4>Vorauszahlungen</h4>
                <Raster spalten={3}>
                  <Feld label="Betriebskosten monatlich">
                    <EuroEingabe
                      wert={m.vorauszahlungBetriebskostenMonatlich}
                      onChange={(v) => setMv(m.id, { vorauszahlungBetriebskostenMonatlich: v })}
                    />
                  </Feld>
                  <Feld label="Heiz-/Warmwasserkosten monatlich">
                    <EuroEingabe
                      wert={m.vorauszahlungHeizkostenMonatlich}
                      onChange={(v) => setMv(m.id, { vorauszahlungHeizkostenMonatlich: v })}
                    />
                  </Feld>
                  <Feld
                    label="Tatsächlich gezahlt im Zeitraum"
                    hinweis={
                      tatsaechlich === undefined
                        ? `ohne Eingabe rechnerisch aus ${formatEuro(monatlich)} × Monate`
                        : 'überschreibt die rechnerische Ermittlung'
                    }
                  >
                    <EuroEingabe
                      wert={tatsaechlich ?? 0}
                      onChange={(v) =>
                        zeitraum &&
                        setMv(m.id, {
                          vorauszahlungenTatsaechlich: {
                            ...(m.vorauszahlungenTatsaechlich ?? {}),
                            [zeitraum.id]: v,
                          },
                        })
                      }
                    />
                  </Feld>
                </Raster>
                {tatsaechlich !== undefined && zeitraum && (
                  <Knopf
                    art="leise"
                    onClick={() => {
                      const rest = { ...(m.vorauszahlungenTatsaechlich ?? {}) };
                      delete rest[zeitraum.id];
                      setMv(m.id, { vorauszahlungenTatsaechlich: rest });
                    }}
                  >
                    Tatsächliche Vorauszahlung zurücksetzen
                  </Knopf>
                )}

                <h4>Vertragliche Grundlagen</h4>
                <div className="schalter-gruppe">
                  <Schalter
                    wert={m.umlageVereinbart}
                    onChange={(umlageVereinbart) => setMv(m.id, { umlageVereinbart })}
                    label="Umlage der Betriebskosten ist im Mietvertrag vereinbart"
                    hinweis="§ 556 Abs. 1 BGB – ohne Vereinbarung sind Betriebskosten mit der Miete abgegolten."
                  />
                  <Schalter
                    wert={m.sonstigeBetriebskostenVereinbart}
                    onChange={(v) => setMv(m.id, { sonstigeBetriebskostenVereinbart: v })}
                    label="Sonstige Betriebskosten sind im Mietvertrag einzeln benannt"
                    hinweis="§ 2 Nr. 17 BetrKV – Voraussetzung für die Umlage sonstiger Betriebskosten."
                  />
                  <Schalter
                    wert={m.betriebskostenpauschale ?? false}
                    onChange={(betriebskostenpauschale) => setMv(m.id, { betriebskostenpauschale })}
                    label="Es ist eine Betriebskostenpauschale vereinbart"
                    hinweis="§ 556 Abs. 2 BGB – dann ist keine Abrechnung geschuldet."
                  />
                </div>

                <Feld label="Abweichende Zustellanschrift (z. B. nach Auszug)" breit>
                  <div className="zeile">
                    <TextEingabe
                      wert={m.zustellanschrift?.strasse ?? ''}
                      platzhalter="Straße und Hausnummer"
                      onChange={(strasse) =>
                        setMv(m.id, {
                          zustellanschrift: {
                            name: m.zustellanschrift?.name ?? m.mieter.join(', '),
                            strasse,
                            plz: m.zustellanschrift?.plz ?? '',
                            ort: m.zustellanschrift?.ort ?? '',
                          },
                        })
                      }
                    />
                    <TextEingabe
                      wert={m.zustellanschrift?.plz ?? ''}
                      platzhalter="PLZ"
                      onChange={(plz) =>
                        setMv(m.id, {
                          zustellanschrift: {
                            name: m.zustellanschrift?.name ?? m.mieter.join(', '),
                            strasse: m.zustellanschrift?.strasse ?? '',
                            plz,
                            ort: m.zustellanschrift?.ort ?? '',
                          },
                        })
                      }
                    />
                    <TextEingabe
                      wert={m.zustellanschrift?.ort ?? ''}
                      platzhalter="Ort"
                      onChange={(ort) =>
                        setMv(m.id, {
                          zustellanschrift: {
                            name: m.zustellanschrift?.name ?? m.mieter.join(', '),
                            strasse: m.zustellanschrift?.strasse ?? '',
                            plz: m.zustellanschrift?.plz ?? '',
                            ort,
                          },
                        })
                      }
                    />
                  </div>
                </Feld>

                <div className="zeile zeile-abschluss">
                  {zeitraum && (
                    <span className="beschreibung">
                      Nutzungsdauer im Abrechnungszeitraum:{' '}
                      {ueberlappungTage(m, zeitraum.von, zeitraum.bis)} von{' '}
                      {tageInZeitraum(zeitraum.von, zeitraum.bis)} Tagen
                    </span>
                  )}
                  <Knopf art="gefahr" onClick={() => loesche(m.id)}>
                    Mietverhältnis löschen
                  </Knopf>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Karte>
  );
}

function ueberlappungTage(m: Mietverhaeltnis, von: string, bis: string): number {
  const start = m.beginn > von ? m.beginn : von;
  const ende = (m.ende ?? '9999-12-31') < bis ? (m.ende ?? '9999-12-31') : bis;
  return tageInZeitraum(start, ende);
}
