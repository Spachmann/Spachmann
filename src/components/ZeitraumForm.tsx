import { useStore } from '../state/store';
import { standardHeizkosten } from '../domain/heizkosten';
import { addMonate, addTage, formatDatum, tageInZeitraum, uuid } from '../domain/util';
import { DatumEingabe, Feld, Hinweisbox, Karte, Knopf, Raster, TextEingabe } from './ui';

export function ZeitraumForm() {
  const { state, update } = useStore();

  const neu = () => {
    const jahr = new Date().getFullYear() - 1;
    const id = uuid();
    update((s) => ({
      ...s,
      abrechnungszeitraeume: [
        ...s.abrechnungszeitraeume,
        {
          id,
          objektId: s.objekt.id,
          bezeichnung: `Betriebskostenabrechnung ${jahr}`,
          von: `${jahr}-01-01`,
          bis: `${jahr}-12-31`,
        },
      ],
      heizkosten: [...s.heizkosten, standardHeizkosten(id)],
      aktiverZeitraumId: id,
    }));
  };

  const loesche = (id: string) =>
    update((s) => {
      const rest = s.abrechnungszeitraeume.filter((z) => z.id !== id);
      return {
        ...s,
        abrechnungszeitraeume: rest,
        kostenpositionen: s.kostenpositionen.filter((p) => p.abrechnungszeitraumId !== id),
        verbraeuche: s.verbraeuche.filter((v) => v.abrechnungszeitraumId !== id),
        leerstandsverbraeuche: s.leerstandsverbraeuche.filter((v) => v.abrechnungszeitraumId !== id),
        heizkosten: s.heizkosten.filter((h) => h.abrechnungszeitraumId !== id),
        aktiverZeitraumId: s.aktiverZeitraumId === id ? rest[0]?.id : s.aktiverZeitraumId,
      };
    });

  return (
    <Karte
      titel="Abrechnungszeiträume"
      beschreibung="Über Betriebskosten ist jährlich abzurechnen (§ 556 Abs. 3 S. 1 BGB). Der Abrechnungszeitraum darf zwölf Monate nicht überschreiten."
      aktion={<Knopf art="primaer" onClick={neu}>+ Abrechnungszeitraum</Knopf>}
    >
      <div className="liste">
        {state.abrechnungszeitraeume.map((z) => {
          const tage = tageInZeitraum(z.von, z.bis);
          const fristEnde = addTage(addMonate(z.bis, 12), 0);
          const aktiv = z.id === state.aktiverZeitraumId;

          const setZ = (patch: Partial<typeof z>) =>
            update((s) => ({
              ...s,
              abrechnungszeitraeume: s.abrechnungszeitraeume.map((x) =>
                x.id === z.id ? { ...x, ...patch } : x,
              ),
            }));

          return (
            <div className={`listeneintrag${aktiv ? ' aktiv' : ''}`} key={z.id}>
              <div className="eintrag-titel">
                {z.bezeichnung}
                {aktiv && <span className="marke marke-aktiv">aktiver Zeitraum</span>}
              </div>
              <Raster spalten={4}>
                <Feld label="Bezeichnung">
                  <TextEingabe wert={z.bezeichnung} onChange={(bezeichnung) => setZ({ bezeichnung })} />
                </Feld>
                <Feld label="Beginn">
                  <DatumEingabe wert={z.von} onChange={(von) => setZ({ von })} />
                </Feld>
                <Feld label="Ende">
                  <DatumEingabe wert={z.bis} onChange={(bis) => setZ({ bis })} />
                </Feld>
                <Feld
                  label="Zugang beim Mieter"
                  hinweis="maßgeblich für die Abrechnungsfrist; leer = heute"
                >
                  <DatumEingabe
                    wert={z.zugangDatum ?? ''}
                    onChange={(zugangDatum) => setZ({ zugangDatum: zugangDatum || undefined })}
                  />
                </Feld>
              </Raster>

              <p className="beschreibung">
                Dauer: <strong>{tage} Tage</strong> · Abrechnungsfrist endet am{' '}
                <strong>{formatDatum(fristEnde)}</strong> (§ 556 Abs. 3 S. 2 BGB)
              </p>

              {tage > 366 && (
                <Hinweisbox art="fehler" titel="Zeitraum zu lang">
                  Der Abrechnungszeitraum umfasst {tage} Tage und überschreitet damit die zulässigen
                  zwölf Monate.
                </Hinweisbox>
              )}

              <div className="zeile zeile-abschluss">
                {!aktiv && (
                  <Knopf onClick={() => update((s) => ({ ...s, aktiverZeitraumId: z.id }))}>
                    Als aktiven Zeitraum wählen
                  </Knopf>
                )}
                {state.abrechnungszeitraeume.length > 1 && (
                  <Knopf art="gefahr" onClick={() => loesche(z.id)}>
                    Zeitraum löschen
                  </Knopf>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Karte>
  );
}
