import { useState } from 'react';
import type { Abrechnungsergebnis, Abrechnungszeile, MieterAbrechnung } from '../domain/berechnung';
import { kostenartOderFallback } from '../domain/katalog';
import type { AppState, Abrechnungszeitraum } from '../domain/types';
import { VERTEILERSCHLUESSEL_BEZEICHNUNG } from '../domain/types';
import {
  addMonate,
  addTage,
  formatDatum,
  formatEuro,
  formatZahl,
  heuteISO,
  summe,
} from '../domain/util';
import { Karte, Knopf } from './ui';

/** Nachkommastellen für die Darstellung des jeweiligen Maßstabs. */
function stellen(einheit: string): number {
  if (einheit === 'Einheit(en)' || einheit === 'Nutzungstage') return 0;
  return 2;
}

function massstabText(z: Abrechnungszeile): string {
  if (z.schluessel === 'DIREKTZUORDNUNG') {
    return z.tage === z.gesamtTage ? 'direkt zugeordnet' : `direkt zugeordnet, ${z.tage}/${z.gesamtTage} Tage`;
  }
  const nk = stellen(z.massstabEinheit);
  const basis = `${formatZahl(z.mieterMassstab, nk)} / ${formatZahl(z.gesamtMassstab, nk)} ${z.massstabEinheit}`;
  if (z.zeitgewichtet && z.tage !== z.gesamtTage) {
    return `${basis} · ${z.tage}/${z.gesamtTage} Tage`;
  }
  return basis;
}

export function AbrechnungAnsicht({
  state,
  zeitraum,
  ergebnis,
}: {
  state: AppState;
  zeitraum: Abrechnungszeitraum;
  ergebnis: Abrechnungsergebnis;
}) {
  const [auswahl, setAuswahl] = useState<string>('alle');
  const sichtbar =
    auswahl === 'alle'
      ? ergebnis.mieterAbrechnungen
      : ergebnis.mieterAbrechnungen.filter((m) => m.nutzung.mietverhaeltnis.id === auswahl);

  return (
    <>
      <Karte
        titel="Abrechnung erstellen"
        beschreibung="Wählen Sie ein Mietverhältnis oder drucken Sie alle Abrechnungen gemeinsam. Über die Druckfunktion des Browsers lässt sich die Abrechnung als PDF speichern."
        aktion={
          <div className="zeile">
            <select value={auswahl} onChange={(e) => setAuswahl(e.target.value)}>
              <option value="alle">Alle Mietverhältnisse ({ergebnis.mieterAbrechnungen.length})</option>
              {ergebnis.mieterAbrechnungen.map((m) => (
                <option key={m.nutzung.mietverhaeltnis.id} value={m.nutzung.mietverhaeltnis.id}>
                  {m.nutzung.mietverhaeltnis.mieter.filter(Boolean).join(', ')} – {m.nutzung.einheit.bezeichnung}
                </option>
              ))}
            </select>
            <Knopf art="primaer" onClick={() => window.print()}>
              Drucken / als PDF speichern
            </Knopf>
          </div>
        }
      >
        <div className="kennzahlen">
          {sichtbar.map((m) => (
            <div
              key={m.nutzung.mietverhaeltnis.id}
              className={`kennzahl ${m.saldo > 0 ? 'kennzahl-rot' : 'kennzahl-gruen'}`}
            >
              <span>{m.nutzung.mietverhaeltnis.mieter.filter(Boolean).join(', ')}</span>
              <strong>{formatEuro(Math.abs(m.saldo))}</strong>
              <small>{m.saldo > 0 ? 'Nachzahlung' : m.saldo < 0 ? 'Guthaben' : 'ausgeglichen'}</small>
            </div>
          ))}
        </div>
      </Karte>

      <div className="druckbereich">
        {sichtbar.map((m) => (
          <Abrechnungsbogen
            key={m.nutzung.mietverhaeltnis.id}
            state={state}
            zeitraum={zeitraum}
            ergebnis={ergebnis}
            mieter={m}
          />
        ))}
      </div>
    </>
  );
}

function Abrechnungsbogen({
  state,
  zeitraum,
  ergebnis,
  mieter,
}: {
  state: AppState;
  zeitraum: Abrechnungszeitraum;
  ergebnis: Abrechnungsergebnis;
  mieter: MieterAbrechnung;
}) {
  const v = state.objekt.vermieter;
  const mv = mieter.nutzung.mietverhaeltnis;
  const einheit = mieter.nutzung.einheit;
  const anschrift = mv.zustellanschrift;
  const kalt = mieter.zeilen.filter((z) => z.gruppe === 'KALT');
  const warm = mieter.zeilen.filter((z) => z.gruppe === 'HEIZUNG');
  const zahlungsziel = addTage(zeitraum.zugangDatum ?? heuteISO(), 30);
  const einwendungsfrist = addMonate(zeitraum.zugangDatum ?? heuteISO(), 12);

  const genutzteSchluessel = Array.from(new Set(mieter.zeilen.map((z) => z.schluessel)));

  return (
    <article className="bogen">
      {/* --- Briefkopf ---------------------------------------------------- */}
      <header className="bogen-kopf">
        <div className="absender">
          <strong>{v.name}</strong>
          {v.zusatz && <div>{v.zusatz}</div>}
          <div>{v.strasse}</div>
          <div>
            {v.plz} {v.ort}
          </div>
          {v.telefon && <div>Telefon: {v.telefon}</div>}
          {v.email && <div>E-Mail: {v.email}</div>}
        </div>
        <div className="datum">
          {state.objekt.ort || v.ort}, den {formatDatum(zeitraum.zugangDatum ?? heuteISO())}
        </div>
      </header>

      <div className="empfaenger">
        {mv.mieter.filter(Boolean).map((name, i) => (
          <div key={i}>{name}</div>
        ))}
        {anschrift ? (
          <>
            <div>{anschrift.strasse}</div>
            <div>
              {anschrift.plz} {anschrift.ort}
            </div>
          </>
        ) : (
          <>
            <div>{state.objekt.strasse}</div>
            <div>
              {state.objekt.plz} {state.objekt.ort}
            </div>
          </>
        )}
      </div>

      <h1 className="bogen-titel">
        Betriebskostenabrechnung für den Zeitraum {formatDatum(zeitraum.von)} bis{' '}
        {formatDatum(zeitraum.bis)}
      </h1>

      <table className="bogen-stammdaten">
        <tbody>
          <tr>
            <th>Mietobjekt</th>
            <td>
              {state.objekt.strasse}, {state.objekt.plz} {state.objekt.ort}
              {state.objekt.bezeichnung ? ` (${state.objekt.bezeichnung})` : ''}
            </td>
          </tr>
          <tr>
            <th>Mieteinheit</th>
            <td>
              {einheit.bezeichnung}
              {einheit.lage ? `, ${einheit.lage}` : ''} · Wohnfläche{' '}
              {formatZahl(einheit.wohnflaecheQm)} m²
            </td>
          </tr>
          <tr>
            <th>Abrechnungszeitraum</th>
            <td>
              {formatDatum(zeitraum.von)} bis {formatDatum(zeitraum.bis)} ({ergebnis.gesamtTage} Tage)
            </td>
          </tr>
          <tr>
            <th>Ihr Nutzungszeitraum</th>
            <td>
              {formatDatum(mieter.nutzung.von)} bis {formatDatum(mieter.nutzung.bis)} (
              {mieter.nutzung.tage} von {ergebnis.gesamtTage} Tagen)
            </td>
          </tr>
          <tr>
            <th>Personen im Haushalt</th>
            <td>
              {formatZahl(mieter.nutzung.personenDurchschnitt, 2)} im Durchschnitt (
              {formatZahl(mieter.nutzung.personentage, 0)} Personentage)
            </td>
          </tr>
          <tr>
            <th>Gesamtwohnfläche des Objekts</th>
            <td>
              {formatZahl(summe(state.einheiten.map((e) => e.wohnflaecheQm)))} m² in{' '}
              {state.einheiten.length} Einheiten
            </td>
          </tr>
        </tbody>
      </table>

      <p className="bogen-text">
        Sehr geehrte Damen und Herren, nachstehend erhalten Sie die Abrechnung der Betriebskosten für
        den oben genannten Zeitraum. Aufgeführt sind die Gesamtkosten des Objekts, der jeweils
        angewandte Verteilerschlüssel und die Berechnung Ihres Anteils.
      </p>

      {/* --- kalte Betriebskosten ------------------------------------------ */}
      {kalt.length > 0 && (
        <>
          <h2>1. Umlagefähige Betriebskosten</h2>
          <Kostentabelle zeilen={kalt} summe={mieter.summeKalteBetriebskosten} />
        </>
      )}

      {/* --- Heiz- und Warmwasserkosten ------------------------------------ */}
      {warm.length > 0 && (
        <>
          <h2>{kalt.length > 0 ? '2.' : '1.'} Heiz- und Warmwasserkosten</h2>
          {ergebnis.heizkosten && (
            <p className="bogen-text klein">
              {ergebnis.heizkosten.aufteilung.warmwasserAnteil.herleitung}
            </p>
          )}
          <Kostentabelle zeilen={warm} summe={mieter.summeHeizUndWarmwasser} />
          {mieter.kuerzungHeizkostenV > 0 && (
            <p className="bogen-text">
              Abzüglich Kürzung nach § 12 Abs. 1 HeizkostenV (15 %):{' '}
              <strong>− {formatEuro(mieter.kuerzungHeizkostenV)}</strong>
            </p>
          )}
        </>
      )}

      {/* --- Abrechnungsergebnis ------------------------------------------- */}
      <h2>{[kalt.length > 0, warm.length > 0].filter(Boolean).length + 1}. Abrechnungsergebnis</h2>
      <table className="bogen-ergebnis">
        <tbody>
          {kalt.length > 0 && (
            <tr>
              <td>Ihr Anteil an den umlagefähigen Betriebskosten</td>
              <td className="rechts">{formatEuro(mieter.summeKalteBetriebskosten)}</td>
            </tr>
          )}
          {warm.length > 0 && (
            <tr>
              <td>Ihr Anteil an den Heiz- und Warmwasserkosten</td>
              <td className="rechts">{formatEuro(mieter.summeHeizUndWarmwasser)}</td>
            </tr>
          )}
          {mieter.kuerzungHeizkostenV > 0 && (
            <tr>
              <td>Kürzung nach § 12 Abs. 1 HeizkostenV</td>
              <td className="rechts">− {formatEuro(mieter.kuerzungHeizkostenV)}</td>
            </tr>
          )}
          <tr className="summe">
            <td>Summe Ihrer Betriebskosten</td>
            <td className="rechts">{formatEuro(mieter.summeUmlagefaehig)}</td>
          </tr>
          <tr>
            <td>
              abzüglich Ihrer Vorauszahlungen
              {mieter.vorauszahlungenGeschaetzt && (
                <span className="klein">
                  {' '}
                  (
                  {formatEuro(
                    mv.vorauszahlungBetriebskostenMonatlich + mv.vorauszahlungHeizkostenMonatlich,
                  )}{' '}
                  monatlich)
                </span>
              )}
            </td>
            <td className="rechts">− {formatEuro(mieter.vorauszahlungen)}</td>
          </tr>
          <tr className="saldo">
            <td>
              {mieter.saldo > 0 ? 'Nachzahlung' : mieter.saldo < 0 ? 'Guthaben zu Ihren Gunsten' : 'Ausgeglichen'}
            </td>
            <td className="rechts">{formatEuro(Math.abs(mieter.saldo))}</td>
          </tr>
        </tbody>
      </table>

      {mieter.saldo > 0 && (
        <p className="bogen-text">
          Bitte überweisen Sie den Nachzahlungsbetrag von{' '}
          <strong>{formatEuro(mieter.saldo)}</strong> bis zum {formatDatum(zahlungsziel)}
          {v.iban ? (
            <>
              {' '}
              auf das Konto {v.kontoinhaber ?? v.name}, IBAN {v.iban}
              {v.bic ? `, BIC ${v.bic}` : ''}
              {v.kreditinstitut ? `, ${v.kreditinstitut}` : ''}
            </>
          ) : null}
          . Bitte geben Sie als Verwendungszweck „Betriebskosten {zeitraum.bezeichnung}, {einheit.bezeichnung}“ an.
        </p>
      )}
      {mieter.saldo < 0 && (
        <p className="bogen-text">
          Das Guthaben von <strong>{formatEuro(-mieter.saldo)}</strong> wird Ihnen innerhalb von 30
          Tagen auf das uns bekannte Konto erstattet bzw. mit der nächsten Mietzahlung verrechnet.
        </p>
      )}

      {/* --- Erläuterung der Verteilerschlüssel ---------------------------- */}
      <h2>Erläuterung der Verteilerschlüssel</h2>
      <ul className="bogen-liste">
        {genutzteSchluessel.map((s) => {
          const zeile = mieter.zeilen.find((z) => z.schluessel === s)!;
          return (
            <li key={s}>
              <strong>{VERTEILERSCHLUESSEL_BEZEICHNUNG[s]}:</strong> {zeile.schluesselErlaeuterung}
            </li>
          );
        })}
        {mieter.nutzung.tage < ergebnis.gesamtTage && (
          <li>
            <strong>Zeitanteilige Umlage:</strong> Da Ihr Mietverhältnis nicht den gesamten
            Abrechnungszeitraum umfasst, wurden die zeitabhängigen Kosten taggenau im Verhältnis{' '}
            {mieter.nutzung.tage}/{ergebnis.gesamtTage} berücksichtigt.
          </li>
        )}
        {ergebnis.leerstandsanteilVermieter > 0 && (
          <li>
            <strong>Leerstand:</strong> Auf leerstehende Einheiten entfallende Kosten wurden nicht auf
            die Mieter umgelegt, sondern vom Vermieter getragen.
          </li>
        )}
      </ul>

      {/* --- Anlage 1: Gesamtkosten ---------------------------------------- */}
      <div className="seitenumbruch" />
      <h2>Anlage 1: Gesamtkosten des Objekts im Abrechnungszeitraum</h2>
      <table className="bogen-tabelle">
        <thead>
          <tr>
            <th>Kostenart</th>
            <th>Rechtsgrundlage</th>
            <th className="rechts">Rechnungsbetrag</th>
            <th className="rechts">Vorwegabzug</th>
            <th className="rechts">umlagefähig</th>
          </tr>
        </thead>
        <tbody>
          {ergebnis.positionsVerteilungen.map((p) => (
            <tr key={p.position.id}>
              <td>{p.position.bezeichnung}</td>
              <td className="klein">{p.kostenart.fundstelle}</td>
              <td className="rechts">{formatEuro(p.gesamtbetrag)}</td>
              <td className="rechts">{p.vorwegabzug ? `− ${formatEuro(p.vorwegabzug)}` : '–'}</td>
              <td className="rechts">{formatEuro(p.umlagefaehigerBetrag)}</td>
            </tr>
          ))}
          {ergebnis.heizkosten?.positionen.map((p) => (
            <tr key={p.id}>
              <td>{p.bezeichnung}</td>
              <td className="klein">{kostenartOderFallback(p.katalogId).fundstelle}</td>
              <td className="rechts">{formatEuro(p.betrag)}</td>
              <td className="rechts">
                {p.nichtUmlagefaehigerAnteil ? `− ${formatEuro(p.nichtUmlagefaehigerAnteil)}` : '–'}
              </td>
              <td className="rechts">
                {formatEuro(Math.max(p.betrag - (p.nichtUmlagefaehigerAnteil ?? 0), 0))}
              </td>
            </tr>
          ))}
          <tr className="summe">
            <td colSpan={4}>Summe der umlagefähigen Kosten</td>
            <td className="rechts">{formatEuro(ergebnis.gesamtkostenUmlagefaehig)}</td>
          </tr>
          {ergebnis.leerstandsanteilVermieter > 0 && (
            <tr>
              <td colSpan={4}>davon auf Leerstand entfallend (vom Vermieter getragen)</td>
              <td className="rechts">{formatEuro(ergebnis.leerstandsanteilVermieter)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* --- Anlage 2: nicht umlagefähige Kosten --------------------------- */}
      <h2>Anlage 2: Nicht umlagefähige Kosten</h2>
      <p className="bogen-text klein">
        Die folgenden Kosten sind nach § 1 Abs. 2 BetrKV keine Betriebskosten und wurden Ihnen nicht
        in Rechnung gestellt. Sie werden ausschließlich zur Transparenz aufgeführt und vom Vermieter
        getragen.
      </p>
      <table className="bogen-tabelle">
        <thead>
          <tr>
            <th>Kostenart</th>
            <th>Rechtsgrundlage</th>
            <th className="rechts">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {ergebnis.nichtUmlagefaehigePositionen.map((p) => (
            <tr key={p.id}>
              <td>{p.bezeichnung}</td>
              <td className="klein">{kostenartOderFallback(p.katalogId).fundstelle}</td>
              <td className="rechts">{formatEuro(p.betrag)}</td>
            </tr>
          ))}
          {ergebnis.vorwegabzuegeGesamt > 0 && (
            <tr>
              <td>Vorwegabzüge aus umlagefähigen Positionen</td>
              <td className="klein">§ 1 Abs. 2 BetrKV</td>
              <td className="rechts">{formatEuro(ergebnis.vorwegabzuegeGesamt)}</td>
            </tr>
          )}
          {ergebnis.nichtUmlagefaehigePositionen.length === 0 &&
            ergebnis.vorwegabzuegeGesamt === 0 && (
              <tr>
                <td colSpan={3}>Es wurden keine nicht umlagefähigen Kosten erfasst.</td>
              </tr>
            )}
          <tr className="summe">
            <td colSpan={2}>Summe der nicht umlagefähigen Kosten</td>
            <td className="rechts">{formatEuro(ergebnis.gesamtkostenNichtUmlagefaehig)}</td>
          </tr>
        </tbody>
      </table>

      {/* --- § 35a EStG ---------------------------------------------------- */}
      {mieter.arbeitskosten35a > 0 && (
        <>
          <h2>Bescheinigung nach § 35a EStG</h2>
          <p className="bogen-text">
            In den auf Sie entfallenden Betriebskosten sind Aufwendungen für haushaltsnahe
            Dienstleistungen und Handwerkerleistungen in Höhe von{' '}
            <strong>{formatEuro(mieter.arbeitskosten35a)}</strong> enthalten (reine Arbeits-,
            Maschinen- und Fahrtkosten ohne Material). Diesen Betrag können Sie in Ihrer
            Einkommensteuererklärung geltend machen.
          </p>
        </>
      )}

      {/* --- Rechtliche Hinweise ------------------------------------------- */}
      <h2>Rechtliche Hinweise</h2>
      <ul className="bogen-liste klein">
        <li>
          <strong>Belegeinsicht:</strong> Sie können die dieser Abrechnung zugrunde liegenden Belege
          nach Terminvereinbarung einsehen. Auf Wunsch übersenden wir Ihnen gegen Kostenerstattung
          Kopien.
        </li>
        <li>
          <strong>Einwendungen:</strong> Einwendungen gegen diese Abrechnung müssen Sie uns spätestens
          bis zum {formatDatum(einwendungsfrist)} – also innerhalb von zwölf Monaten nach Zugang
          dieser Abrechnung – mitteilen (§ 556 Abs. 3 S. 5, 6 BGB). Danach können Sie Einwendungen
          nicht mehr geltend machen, es sei denn, Sie haben die verspätete Geltendmachung nicht zu
          vertreten.
        </li>
        <li>
          <strong>Abrechnungsfrist:</strong> Diese Abrechnung ist Ihnen innerhalb von zwölf Monaten
          nach Ende des Abrechnungszeitraums zu erteilen (§ 556 Abs. 3 S. 2 BGB).
        </li>
        <li>
          <strong>Umlagemaßstab:</strong> Die Verteilung erfolgt nach den im Mietvertrag vereinbarten
          Maßstäben, im Übrigen nach dem Anteil der Wohnfläche (§ 556a Abs. 1 BGB). Heiz- und
          Warmwasserkosten werden zwingend nach der Heizkostenverordnung verteilt.
        </li>
      </ul>

      <div className="unterschrift">
        <p>Mit freundlichen Grüßen</p>
        <div className="unterschrift-linie" />
        <p>{v.name}</p>
      </div>
    </article>
  );
}

function Kostentabelle({ zeilen, summe: gesamt }: { zeilen: Abrechnungszeile[]; summe: number }) {
  return (
    <table className="bogen-tabelle">
      <thead>
        <tr>
          <th>Kostenart</th>
          <th>Rechtsgrundlage</th>
          <th className="rechts">Gesamtkosten</th>
          <th>Verteilerschlüssel</th>
          <th>Ihr Anteil am Maßstab</th>
          <th className="rechts">Ihr Anteil</th>
        </tr>
      </thead>
      <tbody>
        {zeilen.map((z, i) => (
          <tr key={`${z.id}-${i}`}>
            <td>{z.bezeichnung}</td>
            <td className="klein">{z.fundstelle}</td>
            <td className="rechts">{formatEuro(z.gesamtkosten)}</td>
            <td className="klein">{VERTEILERSCHLUESSEL_BEZEICHNUNG[z.schluessel]}</td>
            <td className="klein">{massstabText(z)}</td>
            <td className="rechts">{formatEuro(z.anteil)}</td>
          </tr>
        ))}
        <tr className="summe">
          <td colSpan={5}>Zwischensumme</td>
          <td className="rechts">{formatEuro(gesamt)}</td>
        </tr>
      </tbody>
    </table>
  );
}
