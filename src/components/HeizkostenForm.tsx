import { useStore } from '../state/store';
import { ermittleWarmwasserAnteil, standardHeizkosten, teileHeizkostenAuf } from '../domain/heizkosten';
import { kostenartOderFallback } from '../domain/katalog';
import {
  ZAEHLERART_BEZEICHNUNG,
  type HeizkostenEinstellungen,
  type Verbrauch,
  type Verbrauchsanteil,
  type WarmwasserErmittlung,
  type Zaehlerart,
} from '../domain/types';
import { formatEuro, formatZahl, summe, uuid } from '../domain/util';
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

const ZAEHLERARTEN: Zaehlerart[] = ['HEIZUNG', 'WARMWASSER', 'KALTWASSER', 'SONSTIG'];

export function HeizkostenForm() {
  const { state, update } = useStore();
  const zeitraum = state.abrechnungszeitraeume.find((z) => z.id === state.aktiverZeitraumId);

  if (!zeitraum) {
    return (
      <Karte titel="Heizkosten">
        <Hinweisbox art="warnung" titel="Kein Abrechnungszeitraum">
          Legen Sie zuerst einen Abrechnungszeitraum an.
        </Hinweisbox>
      </Karte>
    );
  }

  const hk =
    state.heizkosten.find((h) => h.abrechnungszeitraumId === zeitraum.id) ??
    standardHeizkosten(zeitraum.id);

  const setHk = (patch: Partial<HeizkostenEinstellungen>) =>
    update((s) => {
      const vorhanden = s.heizkosten.some((h) => h.abrechnungszeitraumId === zeitraum.id);
      return {
        ...s,
        heizkosten: vorhanden
          ? s.heizkosten.map((h) =>
              h.abrechnungszeitraumId === zeitraum.id ? { ...h, ...patch } : h,
            )
          : [...s.heizkosten, { ...hk, ...patch }],
      };
    });

  const heizPositionen = state.kostenpositionen.filter(
    (p) =>
      p.abrechnungszeitraumId === zeitraum.id &&
      p.verteilerschluessel === 'HEIZKOSTENV' &&
      kostenartOderFallback(p.katalogId).umlagefaehig,
  );
  const heizGesamt = summe(
    heizPositionen.map((p) => Math.max(p.betrag - (p.nichtUmlagefaehigerAnteil ?? 0), 0)),
  );
  const aufteilung = teileHeizkostenAuf(heizGesamt, hk);
  const wwAnteil = ermittleWarmwasserAnteil(hk);

  const nutzungen = state.mietverhaeltnisse.filter((m) => {
    const ende = m.ende ?? '9999-12-31';
    return m.beginn <= zeitraum.bis && ende >= zeitraum.von;
  });

  const setVerbrauch = (id: string, patch: Partial<Verbrauch>) =>
    update((s) => ({
      ...s,
      verbraeuche: s.verbraeuche.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));

  const neuerVerbrauch = (mietverhaeltnisId: string, art: Zaehlerart) =>
    update((s) => ({
      ...s,
      verbraeuche: [
        ...s.verbraeuche,
        {
          id: uuid(),
          abrechnungszeitraumId: zeitraum.id,
          mietverhaeltnisId,
          art,
          verbrauch: 0,
          einheit: art === 'HEIZUNG' ? 'Einheiten' : 'm3',
        },
      ],
    }));

  const loescheVerbrauch = (id: string) =>
    update((s) => ({ ...s, verbraeuche: s.verbraeuche.filter((v) => v.id !== id) }));

  const neuerLeerstandsverbrauch = () =>
    update((s) => ({
      ...s,
      leerstandsverbraeuche: [
        ...s.leerstandsverbraeuche,
        {
          id: uuid(),
          abrechnungszeitraumId: zeitraum.id,
          einheitId: s.einheiten[0]?.id ?? '',
          art: 'HEIZUNG',
          verbrauch: 0,
          einheit: 'Einheiten',
        },
      ],
    }));

  return (
    <>
      <Karte
        titel="Heiz- und Warmwasserkosten nach HeizkostenV"
        beschreibung="Die Verteilung der Heiz- und Warmwasserkosten richtet sich zwingend nach der Heizkostenverordnung und geht abweichenden Vereinbarungen im Mietvertrag vor (§ 2 HeizkostenV)."
      >
        <Schalter
          wert={hk.aktiv}
          onChange={(aktiv) => setHk({ aktiv })}
          label="Heiz-/Warmwasserkosten nach HeizkostenV abrechnen"
          hinweis="Deaktivieren Sie dies nur, wenn der Mieter selbst mit dem Versorger abrechnet (z. B. Gasetagenheizung)."
        />

        {hk.aktiv && (
          <>
            <h3>Verbrauchsanteile</h3>
            <Raster spalten={2}>
              <Feld
                label="Verbrauchsanteil Heizkosten"
                hinweis="§ 7 Abs. 1 HeizkostenV: zulässig sind 50 %, 60 % oder 70 %"
              >
                <Auswahl<string>
                  wert={String(hk.verbrauchsanteilHeizung)}
                  onChange={(v) => setHk({ verbrauchsanteilHeizung: Number(v) as Verbrauchsanteil })}
                  optionen={[
                    { wert: '50', label: '50 % Verbrauch / 50 % Grundkosten' },
                    { wert: '60', label: '60 % Verbrauch / 40 % Grundkosten' },
                    { wert: '70', label: '70 % Verbrauch / 30 % Grundkosten' },
                  ]}
                />
              </Feld>
              <Feld label="Verbrauchsanteil Warmwasserkosten" hinweis="§ 8 Abs. 1 HeizkostenV">
                <Auswahl<string>
                  wert={String(hk.verbrauchsanteilWarmwasser)}
                  onChange={(v) =>
                    setHk({ verbrauchsanteilWarmwasser: Number(v) as Verbrauchsanteil })
                  }
                  optionen={[
                    { wert: '50', label: '50 % Verbrauch / 50 % Grundkosten' },
                    { wert: '60', label: '60 % Verbrauch / 40 % Grundkosten' },
                    { wert: '70', label: '70 % Verbrauch / 30 % Grundkosten' },
                  ]}
                />
              </Feld>
            </Raster>

            <h3>Trennung von Heizung und Warmwasser</h3>
            <Raster spalten={2}>
              <Feld label="Ermittlung des Warmwasseranteils" breit>
                <Auswahl<WarmwasserErmittlung>
                  wert={hk.warmwasserErmittlung}
                  onChange={(warmwasserErmittlung) => setHk({ warmwasserErmittlung })}
                  optionen={[
                    { wert: 'GETRENNT', label: 'Getrennte Anlagen – Kosten werden separat erfasst' },
                    { wert: 'WAERMEZAEHLER', label: 'Verbundene Anlage – Wärmezähler für Warmwasser' },
                    { wert: 'FORMEL_9_2', label: 'Verbundene Anlage – Formel nach § 9 Abs. 2 HeizkostenV' },
                    { wert: 'MANUELL', label: 'Verbundene Anlage – manueller Prozentsatz' },
                  ]}
                />
              </Feld>

              {hk.warmwasserErmittlung === 'WAERMEZAEHLER' && (
                <Feld label="Gemessene Wärmemenge Warmwasser">
                  <ZahlEingabe
                    wert={hk.waermemengeWarmwasserKwh ?? 0}
                    onChange={(waermemengeWarmwasserKwh) => setHk({ waermemengeWarmwasserKwh })}
                    einheit="kWh"
                  />
                </Feld>
              )}

              {hk.warmwasserErmittlung === 'FORMEL_9_2' && (
                <>
                  <Feld label="Verbrauchtes Warmwasser">
                    <ZahlEingabe
                      wert={hk.warmwasserVolumenM3 ?? 0}
                      onChange={(warmwasserVolumenM3) => setHk({ warmwasserVolumenM3 })}
                      einheit="m³"
                    />
                  </Feld>
                  <Feld label="Mittlere Warmwassertemperatur" hinweis="Regelwert 60 °C">
                    <ZahlEingabe
                      wert={hk.warmwasserTemperaturC ?? 60}
                      onChange={(warmwasserTemperaturC) => setHk({ warmwasserTemperaturC })}
                      einheit="°C"
                    />
                  </Feld>
                </>
              )}

              {hk.warmwasserErmittlung === 'MANUELL' && (
                <>
                  <Feld label="Warmwasseranteil">
                    <ZahlEingabe
                      wert={hk.warmwasserAnteilProzentManuell ?? 0}
                      onChange={(warmwasserAnteilProzentManuell) =>
                        setHk({ warmwasserAnteilProzentManuell })
                      }
                      einheit="%"
                    />
                  </Feld>
                  <Feld label="Begründung">
                    <TextEingabe
                      wert={hk.begruendungManuell ?? ''}
                      onChange={(begruendungManuell) => setHk({ begruendungManuell })}
                    />
                  </Feld>
                </>
              )}

              {hk.warmwasserErmittlung !== 'GETRENNT' && (
                <Feld
                  label="Gesamtwärmemenge der Anlage"
                  hinweis="erforderlich, um den Warmwasseranteil zu bestimmen"
                >
                  <ZahlEingabe
                    wert={hk.gesamtwaermemengeKwh ?? 0}
                    onChange={(gesamtwaermemengeKwh) => setHk({ gesamtwaermemengeKwh })}
                    einheit="kWh"
                  />
                </Feld>
              )}
            </Raster>

            <Hinweisbox art={wwAnteil.unvollstaendig ? 'warnung' : 'info'} titel="Herleitung">
              {wwAnteil.herleitung}
            </Hinweisbox>

            <h3>Verbrauchserfassung</h3>
            <div className="schalter-gruppe">
              <Schalter
                wert={hk.verbrauchsabhaengigAbgerechnet}
                onChange={(verbrauchsabhaengigAbgerechnet) => setHk({ verbrauchsabhaengigAbgerechnet })}
                label="Es wurde verbrauchsabhängig abgerechnet"
                hinweis="Andernfalls kürzt § 12 Abs. 1 HeizkostenV den Mieteranteil um 15 %."
              />
              <Schalter
                wert={hk.verbrauchsinformationErteilt ?? true}
                onChange={(verbrauchsinformationErteilt) => setHk({ verbrauchsinformationErteilt })}
                label="Unterjährige Verbrauchsinformationen wurden erteilt"
                hinweis="§ 6a HeizkostenV bei fernablesbarer Ausstattung; sonst 3 % Kürzungsrecht."
              />
            </div>
            {!hk.verbrauchsabhaengigAbgerechnet && (
              <Feld label="Grund für die fehlende Verbrauchserfassung" breit>
                <TextEingabe
                  wert={hk.grundKeineVerbrauchserfassung ?? ''}
                  onChange={(grundKeineVerbrauchserfassung) => setHk({ grundKeineVerbrauchserfassung })}
                />
              </Feld>
            )}

            <h3>Aufteilung der erfassten Heizkosten</h3>
            {heizGesamt === 0 ? (
              <LeerZustand text="Erfassen Sie unter „Kosten“ Positionen mit dem Verteilerschlüssel „Heiz-/Warmwasserkosten nach HeizkostenV“." />
            ) : (
              <table className="tabelle">
                <tbody>
                  <tr>
                    <td>Gesamtkosten Heizung und Warmwasser</td>
                    <td className="rechts">{formatEuro(aufteilung.gesamt)}</td>
                  </tr>
                  <tr>
                    <td>
                      davon Warmwasserbereitung ({formatZahl(wwAnteil.anteil * 100, 2)} %, § 9 HeizkostenV)
                    </td>
                    <td className="rechts">{formatEuro(aufteilung.warmwasserKosten)}</td>
                  </tr>
                  <tr>
                    <td>verbleibende Heizkosten</td>
                    <td className="rechts">{formatEuro(aufteilung.heizkosten)}</td>
                  </tr>
                  <tr>
                    <td>· Heizung Grundkosten ({100 - hk.verbrauchsanteilHeizung} %, nach Wohnfläche)</td>
                    <td className="rechts">{formatEuro(aufteilung.heizungGrundkosten)}</td>
                  </tr>
                  <tr>
                    <td>· Heizung Verbrauchskosten ({hk.verbrauchsanteilHeizung} %)</td>
                    <td className="rechts">{formatEuro(aufteilung.heizungVerbrauchskosten)}</td>
                  </tr>
                  <tr>
                    <td>· Warmwasser Grundkosten ({100 - hk.verbrauchsanteilWarmwasser} %, nach Wohnfläche)</td>
                    <td className="rechts">{formatEuro(aufteilung.warmwasserGrundkosten)}</td>
                  </tr>
                  <tr>
                    <td>· Warmwasser Verbrauchskosten ({hk.verbrauchsanteilWarmwasser} %)</td>
                    <td className="rechts">{formatEuro(aufteilung.warmwasserVerbrauchskosten)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </>
        )}
      </Karte>

      <Karte
        titel="Zählerstände und Verbräuche"
        beschreibung="Verbrauchswerte werden dem Mietverhältnis zugeordnet. Bei Mieterwechsel ist eine Zwischenablesung erforderlich – erfassen Sie die abgelesenen Werte je Mietverhältnis getrennt."
      >
        {nutzungen.length === 0 ? (
          <LeerZustand text="Im Abrechnungszeitraum besteht kein Mietverhältnis." />
        ) : (
          <div className="liste">
            {nutzungen.map((m) => {
              const einheit = state.einheiten.find((e) => e.id === m.einheitId);
              const eigene = state.verbraeuche.filter(
                (v) => v.abrechnungszeitraumId === zeitraum.id && v.mietverhaeltnisId === m.id,
              );
              return (
                <div className="listeneintrag" key={m.id}>
                  <div className="eintrag-titel">
                    {m.mieter.filter(Boolean).join(', ') || '(ohne Namen)'}
                    {einheit && <span className="marke">{einheit.bezeichnung}</span>}
                  </div>
                  {eigene.length === 0 && <LeerZustand text="Keine Verbrauchswerte erfasst." />}
                  {eigene.map((v) => (
                    <div className="zeile" key={v.id}>
                      <Feld label="Zählerart">
                        <Auswahl<Zaehlerart>
                          wert={v.art}
                          onChange={(art) => setVerbrauch(v.id, { art })}
                          optionen={ZAEHLERARTEN.map((a) => ({ wert: a, label: ZAEHLERART_BEZEICHNUNG[a] }))}
                        />
                      </Feld>
                      <Feld label="Zählernummer">
                        <TextEingabe
                          wert={v.zaehlernummer ?? ''}
                          onChange={(zaehlernummer) => setVerbrauch(v.id, { zaehlernummer })}
                        />
                      </Feld>
                      <Feld label="Anfangsstand">
                        <ZahlEingabe
                          wert={v.standAnfang ?? 0}
                          onChange={(standAnfang) =>
                            setVerbrauch(v.id, { standAnfang, verbrauch: undefined })
                          }
                        />
                      </Feld>
                      <Feld label="Endstand">
                        <ZahlEingabe
                          wert={v.standEnde ?? 0}
                          onChange={(standEnde) => setVerbrauch(v.id, { standEnde, verbrauch: undefined })}
                        />
                      </Feld>
                      <Feld label="oder Verbrauch direkt">
                        <ZahlEingabe
                          wert={v.verbrauch ?? (v.standEnde ?? 0) - (v.standAnfang ?? 0)}
                          onChange={(verbrauch) => setVerbrauch(v.id, { verbrauch })}
                          einheit={v.einheit}
                        />
                      </Feld>
                      <Knopf art="leise" onClick={() => loescheVerbrauch(v.id)}>
                        entfernen
                      </Knopf>
                    </div>
                  ))}
                  <div className="zeile">
                    {ZAEHLERARTEN.slice(0, 3).map((a) => (
                      <Knopf key={a} art="leise" onClick={() => neuerVerbrauch(m.id, a)}>
                        + {a === 'HEIZUNG' ? 'Heizung' : a === 'WARMWASSER' ? 'Warmwasser' : 'Kaltwasser'}
                      </Knopf>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Karte>

      <Karte
        titel="Verbrauch während Leerstands"
        beschreibung="Verbrauch, der auf leerstehende Einheiten entfällt, wird nicht auf die Mieter verteilt, sondern vom Vermieter getragen."
        aktion={<Knopf onClick={neuerLeerstandsverbrauch}>+ Leerstandsverbrauch</Knopf>}
      >
        {state.leerstandsverbraeuche.filter((v) => v.abrechnungszeitraumId === zeitraum.id).length ===
        0 ? (
          <LeerZustand text="Kein Leerstandsverbrauch erfasst." />
        ) : (
          state.leerstandsverbraeuche
            .filter((v) => v.abrechnungszeitraumId === zeitraum.id)
            .map((v) => (
              <div className="zeile" key={v.id}>
                <Feld label="Einheit">
                  <Auswahl
                    wert={v.einheitId}
                    onChange={(einheitId) =>
                      update((s) => ({
                        ...s,
                        leerstandsverbraeuche: s.leerstandsverbraeuche.map((x) =>
                          x.id === v.id ? { ...x, einheitId } : x,
                        ),
                      }))
                    }
                    optionen={state.einheiten.map((e) => ({ wert: e.id, label: e.bezeichnung }))}
                  />
                </Feld>
                <Feld label="Zählerart">
                  <Auswahl<Zaehlerart>
                    wert={v.art}
                    onChange={(art) =>
                      update((s) => ({
                        ...s,
                        leerstandsverbraeuche: s.leerstandsverbraeuche.map((x) =>
                          x.id === v.id ? { ...x, art } : x,
                        ),
                      }))
                    }
                    optionen={ZAEHLERARTEN.map((a) => ({ wert: a, label: ZAEHLERART_BEZEICHNUNG[a] }))}
                  />
                </Feld>
                <Feld label="Verbrauch">
                  <ZahlEingabe
                    wert={v.verbrauch}
                    onChange={(verbrauch) =>
                      update((s) => ({
                        ...s,
                        leerstandsverbraeuche: s.leerstandsverbraeuche.map((x) =>
                          x.id === v.id ? { ...x, verbrauch } : x,
                        ),
                      }))
                    }
                    einheit={v.einheit}
                  />
                </Feld>
                <Knopf
                  art="leise"
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      leerstandsverbraeuche: s.leerstandsverbraeuche.filter((x) => x.id !== v.id),
                    }))
                  }
                >
                  entfernen
                </Knopf>
              </div>
            ))
        )}
      </Karte>
    </>
  );
}
