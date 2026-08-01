import type { Abrechnungsergebnis } from '../domain/berechnung';
import type { Pruefbericht, Schweregrad } from '../domain/pruefung';
import { formatDatum, formatEuro } from '../domain/util';
import { Hinweisbox, Karte, LeerZustand } from './ui';

const SYMBOL: Record<Schweregrad, string> = {
  FEHLER: '✕',
  WARNUNG: '!',
  HINWEIS: 'i',
};

const TITEL: Record<Schweregrad, string> = {
  FEHLER: 'Fehler – die Abrechnung ist so nicht wirksam',
  WARNUNG: 'Warnungen – bitte prüfen',
  HINWEIS: 'Hinweise',
};

export function PruefungAnsicht({
  bericht,
  ergebnis,
}: {
  bericht: Pruefbericht;
  ergebnis: Abrechnungsergebnis;
}) {
  const gruppen: Schweregrad[] = ['FEHLER', 'WARNUNG', 'HINWEIS'];

  return (
    <>
      <Karte
        titel="Rechtsprüfung"
        beschreibung="Geprüft werden die formellen Mindestanforderungen an eine Betriebskostenabrechnung sowie die materiellen Vorgaben aus BGB, BetrKV und HeizkostenV."
      >
        {bericht.erteilbar ? (
          <Hinweisbox art="erfolg" titel="Keine Fehler festgestellt">
            Die Abrechnung enthält alle formell erforderlichen Angaben: Zusammenstellung der
            Gesamtkosten, Angabe und Erläuterung der Verteilerschlüssel, Berechnung des Mieteranteils
            und Abzug der Vorauszahlungen.
          </Hinweisbox>
        ) : (
          <Hinweisbox art="fehler" titel={`${bericht.anzahlFehler} Fehler festgestellt`}>
            Solange Fehler bestehen, ist die Abrechnung angreifbar. Beheben Sie die aufgeführten
            Punkte, bevor Sie die Abrechnung versenden.
          </Hinweisbox>
        )}

        <div className="kennzahlen">
          <div className="kennzahl">
            <span>Abrechnungsfrist endet</span>
            <strong>{formatDatum(bericht.abrechnungsfristEnde)}</strong>
            <small>
              {bericht.abrechnungsfristAbgelaufen
                ? 'Frist abgelaufen – Nachforderungen ausgeschlossen'
                : '§ 556 Abs. 3 S. 2 BGB'}
            </small>
          </div>
          <div className="kennzahl kennzahl-gruen">
            <span>umlagefähige Gesamtkosten</span>
            <strong>{formatEuro(ergebnis.gesamtkostenUmlagefaehig)}</strong>
            <small>auf die Mieter verteilbar</small>
          </div>
          <div className="kennzahl kennzahl-rot">
            <span>nicht umlagefähig</span>
            <strong>{formatEuro(ergebnis.gesamtkostenNichtUmlagefaehig)}</strong>
            <small>trägt der Vermieter</small>
          </div>
          <div className="kennzahl">
            <span>Leerstandsanteil</span>
            <strong>{formatEuro(ergebnis.leerstandsanteilVermieter)}</strong>
            <small>trägt der Vermieter</small>
          </div>
        </div>
      </Karte>

      {gruppen.map((g) => {
        const befunde = bericht.befunde.filter((b) => b.schweregrad === g);
        if (befunde.length === 0) return null;
        return (
          <Karte key={g} titel={TITEL[g]}>
            <ul className="befunde">
              {befunde.map((b, i) => (
                <li key={i} className={`befund befund-${g.toLowerCase()}`}>
                  <span className="befund-symbol">{SYMBOL[g]}</span>
                  <div>
                    <strong>{b.titel}</strong>
                    <p>{b.beschreibung}</p>
                    <p className="befund-meta">
                      {b.rechtsgrundlage && <span className="marke marke-leise">{b.rechtsgrundlage}</span>}
                      {b.bereich && <span className="marke marke-leise">Bereich: {b.bereich}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Karte>
        );
      })}

      {bericht.befunde.length === 0 && (
        <Karte>
          <LeerZustand text="Keine Befunde." />
        </Karte>
      )}
    </>
  );
}
