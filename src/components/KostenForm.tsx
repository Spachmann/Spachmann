import { useMemo } from 'react';
import { useStore } from '../state/store';
import {
  BETRIEBSKOSTEN,
  NICHT_UMLAGEFAEHIGE_KOSTEN,
  kostenartOderFallback,
} from '../domain/katalog';
import {
  VERTEILERSCHLUESSEL_BEZEICHNUNG,
  ZAEHLERART_BEZEICHNUNG,
  type Kostenposition,
  type Verteilerschluessel,
  type Zaehlerart,
} from '../domain/types';
import { formatEuro, summe, uuid } from '../domain/util';
import { EinheitAuswahl } from './StammdatenForm';
import {
  Auswahl,
  DatumEingabe,
  EuroEingabe,
  Feld,
  Hinweisbox,
  Karte,
  Knopf,
  LeerZustand,
  Raster,
  TextEingabe,
} from './ui';

export function KostenForm() {
  const { state, update } = useStore();
  const zeitraum = state.abrechnungszeitraeume.find((z) => z.id === state.aktiverZeitraumId);

  const positionen = useMemo(
    () => state.kostenpositionen.filter((p) => p.abrechnungszeitraumId === zeitraum?.id),
    [state.kostenpositionen, zeitraum?.id],
  );

  const umlagefaehige = positionen.filter((p) => kostenartOderFallback(p.katalogId).umlagefaehig);
  const nichtUmlagefaehige = positionen.filter(
    (p) => !kostenartOderFallback(p.katalogId).umlagefaehig,
  );

  const summeUmlagefaehig = summe(
    umlagefaehige.map((p) => p.betrag - (p.nichtUmlagefaehigerAnteil ?? 0)),
  );
  const summeVorwegabzug = summe(umlagefaehige.map((p) => p.nichtUmlagefaehigerAnteil ?? 0));
  const summeNichtUmlagefaehig = summe(nichtUmlagefaehige.map((p) => p.betrag)) + summeVorwegabzug;

  if (!zeitraum) {
    return (
      <Karte titel="Kosten">
        <Hinweisbox art="warnung" titel="Kein Abrechnungszeitraum">
          Legen Sie zuerst einen Abrechnungszeitraum an.
        </Hinweisbox>
      </Karte>
    );
  }

  const setP = (id: string, patch: Partial<Kostenposition>) =>
    update((s) => ({
      ...s,
      kostenpositionen: s.kostenpositionen.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  const neu = (katalogId: string) => {
    const art = kostenartOderFallback(katalogId);
    update((s) => ({
      ...s,
      kostenpositionen: [
        ...s.kostenpositionen,
        {
          id: uuid(),
          abrechnungszeitraumId: zeitraum.id,
          katalogId,
          bezeichnung: art.bezeichnung,
          betrag: 0,
          verteilerschluessel: art.standardSchluessel,
          verbrauchsart: art.verbrauchsart,
        },
      ],
    }));
  };

  const loesche = (id: string) =>
    update((s) => ({ ...s, kostenpositionen: s.kostenpositionen.filter((p) => p.id !== id) }));

  const wechsleKostenart = (p: Kostenposition, katalogId: string) => {
    const art = kostenartOderFallback(katalogId);
    setP(p.id, {
      katalogId,
      bezeichnung: p.bezeichnung === kostenartOderFallback(p.katalogId).bezeichnung ? art.bezeichnung : p.bezeichnung,
      verteilerschluessel: art.standardSchluessel,
      verbrauchsart: art.verbrauchsart,
    });
  };

  const renderPosition = (p: Kostenposition) => {
    const art = kostenartOderFallback(p.katalogId);
    const rest = p.betrag - (p.nichtUmlagefaehigerAnteil ?? 0);

    return (
      <div className="listeneintrag" key={p.id}>
        <div className="eintrag-titel">
          {p.bezeichnung || art.bezeichnung}
          <span className={`marke ${art.umlagefaehig ? 'marke-gruen' : 'marke-rot'}`}>
            {art.umlagefaehig ? 'umlagefähig' : 'nicht umlagefähig'}
          </span>
          <span className="marke marke-leise">{art.fundstelle}</span>
        </div>

        <Raster spalten={3}>
          <Feld label="Kostenart">
            <Auswahl
              wert={p.katalogId}
              onChange={(k) => wechsleKostenart(p, k)}
              optionen={[
                ...BETRIEBSKOSTEN.map((k) => ({ wert: k.id, label: `${k.fundstelle} – ${k.bezeichnung}` })),
                ...NICHT_UMLAGEFAEHIGE_KOSTEN.map((k) => ({
                  wert: k.id,
                  label: `[nicht umlagefähig] ${k.bezeichnung}`,
                })),
              ]}
            />
          </Feld>
          <Feld label="Bezeichnung in der Abrechnung">
            <TextEingabe wert={p.bezeichnung} onChange={(bezeichnung) => setP(p.id, { bezeichnung })} />
          </Feld>
          <Feld label="Betrag (brutto)">
            <EuroEingabe wert={p.betrag} onChange={(betrag) => setP(p.id, { betrag })} />
          </Feld>
        </Raster>

        {art.umlagefaehig && (
          <Raster spalten={3}>
            <Feld label="Verteilerschlüssel" hinweis={art.hinweis}>
              <Auswahl<Verteilerschluessel>
                wert={p.verteilerschluessel}
                onChange={(verteilerschluessel) => setP(p.id, { verteilerschluessel })}
                optionen={(art.gruppe === 'HEIZKOSTEN'
                  ? (['HEIZKOSTENV'] as Verteilerschluessel[])
                  : (Object.keys(VERTEILERSCHLUESSEL_BEZEICHNUNG) as Verteilerschluessel[]).filter(
                      (k) => k !== 'HEIZKOSTENV',
                    )
                ).map((k) => ({
                  wert: k,
                  label:
                    VERTEILERSCHLUESSEL_BEZEICHNUNG[k] +
                    (art.erlaubteSchluessel.includes(k) ? '' : ' (untypisch)'),
                }))}
              />
            </Feld>

            {p.verteilerschluessel === 'VERBRAUCH' && (
              <Feld label="Zählerart">
                <Auswahl<Zaehlerart>
                  wert={p.verbrauchsart ?? 'KALTWASSER'}
                  onChange={(verbrauchsart) => setP(p.id, { verbrauchsart })}
                  optionen={(Object.keys(ZAEHLERART_BEZEICHNUNG) as Zaehlerart[]).map((z) => ({
                    wert: z,
                    label: ZAEHLERART_BEZEICHNUNG[z],
                  }))}
                />
              </Feld>
            )}

            {p.verteilerschluessel === 'DIREKTZUORDNUNG' && (
              <Feld label="Betroffene Einheit">
                <EinheitAuswahl
                  wert={p.direktEinheitId ?? ''}
                  onChange={(direktEinheitId) => setP(p.id, { direktEinheitId })}
                />
              </Feld>
            )}

            <Feld
              label="Vorwegabzug (nicht umlagefähiger Anteil)"
              hinweis={`verbleiben ${formatEuro(rest)} zur Umlage`}
            >
              <EuroEingabe
                wert={p.nichtUmlagefaehigerAnteil ?? 0}
                onChange={(v) => setP(p.id, { nichtUmlagefaehigerAnteil: v })}
              />
            </Feld>
          </Raster>
        )}

        {art.umlagefaehig && (p.nichtUmlagefaehigerAnteil ?? 0) > 0 && (
          <Feld label="Begründung des Vorwegabzugs" breit>
            <TextEingabe
              wert={p.begruendungVorwegabzug ?? ''}
              onChange={(begruendungVorwegabzug) => setP(p.id, { begruendungVorwegabzug })}
              platzhalter="z. B. 25 % Instandhaltungs- und Verwaltungsanteil laut Hauswartvertrag"
            />
          </Feld>
        )}

        <Raster spalten={4}>
          <Feld label="Belegnummer">
            <TextEingabe wert={p.belegnummer ?? ''} onChange={(belegnummer) => setP(p.id, { belegnummer })} />
          </Feld>
          <Feld label="Belegdatum">
            <DatumEingabe
              wert={p.belegdatum ?? ''}
              onChange={(belegdatum) => setP(p.id, { belegdatum: belegdatum || undefined })}
            />
          </Feld>
          {art.arbeitskostenRelevant && art.umlagefaehig && (
            <Feld
              label="davon Arbeitskosten"
              hinweis="für die Bescheinigung nach § 35a EStG (haushaltsnahe Dienstleistungen)"
            >
              <EuroEingabe
                wert={p.arbeitskostenAnteil ?? 0}
                onChange={(arbeitskostenAnteil) => setP(p.id, { arbeitskostenAnteil })}
              />
            </Feld>
          )}
          <Feld label="Anmerkung">
            <TextEingabe wert={p.anmerkung ?? ''} onChange={(anmerkung) => setP(p.id, { anmerkung })} />
          </Feld>
        </Raster>

        <p className="beschreibung">{art.beschreibung}</p>

        <div className="zeile zeile-abschluss">
          <Knopf art="gefahr" onClick={() => loesche(p.id)}>
            Position löschen
          </Knopf>
        </div>
      </div>
    );
  };

  return (
    <>
      <Karte
        titel="Kostenübersicht"
        beschreibung={`Abrechnungszeitraum: ${zeitraum.bezeichnung}`}
      >
        <div className="kennzahlen">
          <div className="kennzahl kennzahl-gruen">
            <span>umlagefähig</span>
            <strong>{formatEuro(summeUmlagefaehig)}</strong>
            <small>{umlagefaehige.length} Position(en) nach § 2 BetrKV</small>
          </div>
          <div className="kennzahl kennzahl-rot">
            <span>nicht umlagefähig</span>
            <strong>{formatEuro(summeNichtUmlagefaehig)}</strong>
            <small>
              {nichtUmlagefaehige.length} Position(en) zzgl. {formatEuro(summeVorwegabzug)} Vorwegabzug
            </small>
          </div>
          <div className="kennzahl">
            <span>Gesamtaufwand</span>
            <strong>{formatEuro(summeUmlagefaehig + summeNichtUmlagefaehig)}</strong>
            <small>alle erfassten Kosten des Zeitraums</small>
          </div>
        </div>
      </Karte>

      <Karte
        titel="Umlagefähige Betriebskosten"
        beschreibung="Der Katalog des § 2 BetrKV ist abschließend. Wählen Sie die passende Kostenart; der übliche Verteilerschlüssel wird vorbelegt."
        aktion={
          <Auswahl
            wert=""
            onChange={(k) => k && neu(k)}
            optionen={[
              { wert: '', label: '+ Betriebskostenart hinzufügen' },
              ...BETRIEBSKOSTEN.map((k) => ({ wert: k.id, label: `${k.fundstelle} – ${k.bezeichnung}` })),
            ]}
          />
        }
      >
        {umlagefaehige.length === 0 ? (
          <LeerZustand text="Noch keine umlagefähigen Kosten erfasst." />
        ) : (
          <div className="liste">{umlagefaehige.map(renderPosition)}</div>
        )}
      </Karte>

      <Karte
        titel="Nicht umlagefähige Kosten"
        beschreibung="Diese Kosten trägt der Vermieter (§ 1 Abs. 2 BetrKV). Sie werden nicht auf die Mieter verteilt, aber zur Transparenz in einer Anlage zur Abrechnung ausgewiesen."
        aktion={
          <Auswahl
            wert=""
            onChange={(k) => k && neu(k)}
            optionen={[
              { wert: '', label: '+ nicht umlagefähige Kosten hinzufügen' },
              ...NICHT_UMLAGEFAEHIGE_KOSTEN.map((k) => ({ wert: k.id, label: k.bezeichnung })),
            ]}
          />
        }
      >
        {nichtUmlagefaehige.length === 0 ? (
          <LeerZustand text="Keine nicht umlagefähigen Kosten erfasst." />
        ) : (
          <div className="liste">{nichtUmlagefaehige.map(renderPosition)}</div>
        )}
      </Karte>
    </>
  );
}
