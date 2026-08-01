# Nebenkostenabrechnung

Anwendung zur Erfassung von Betriebskosten und zur Erstellung rechtskonformer
Nebenkostenabrechnungen für Wohnraummieter nach deutschem Recht.

Die Anwendung trennt konsequent **umlagefähige** von **nicht umlagefähigen**
Kosten, erzeugt je Mietverhältnis eine prüffähige Abrechnung mit allen gesetzlich
geforderten Angaben und prüft die Abrechnung vor dem Versand auf formelle und
materielle Mängel.

## Schnellstart

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Rechenkern und Rechtsprüfung testen
npm run build      # Produktionsbuild nach dist/
```

Über die Schaltfläche **„Beispiel laden“** wird ein vollständig ausgefülltes
Musterobjekt geladen (vier Wohnungen, Mieterwechsel, ein Monat Leerstand,
verbundene Heiz-/Warmwasseranlage) – geeignet, um die Anwendung ohne eigene
Dateneingabe kennenzulernen.

## Rechtsgrundlagen

| Norm | Umsetzung in der Anwendung |
| --- | --- |
| § 556 Abs. 1 BGB | Umlage nur bei vertraglicher Vereinbarung – je Mietverhältnis hinterlegt und geprüft |
| § 556 Abs. 2 BGB | Betriebskostenpauschale: Hinweis, dass keine Abrechnung geschuldet ist |
| § 556 Abs. 3 S. 1 BGB | Abrechnungszeitraum höchstens zwölf Monate – wird erzwungen |
| § 556 Abs. 3 S. 2, 3 BGB | Abrechnungsfrist von zwölf Monaten; Ausschluss von Nachforderungen bei Fristablauf |
| § 556 Abs. 3 S. 5, 6 BGB | Einwendungsfrist des Mieters wird in der Abrechnung datiert ausgewiesen |
| § 556a Abs. 1 BGB | Abrechnungsmaßstäbe: Wohnfläche als Regelmaßstab, Verbrauch bei Erfassung |
| § 1 Abs. 2 BetrKV | Verwaltungs- und Instandhaltungskosten sind keine Betriebskosten |
| § 2 Nr. 1–17 BetrKV | Vollständiger Katalog der umlagefähigen Betriebskosten |
| § 2 Nr. 17 BetrKV | Sonstige Betriebskosten nur bei ausdrücklicher Vereinbarung |
| § 230 Abs. 5 TKG | Wegfall des Nebenkostenprivilegs für Kabel-TV zum 30.06.2024 |
| § 72 Abs. 1 TKG | Glasfaserbereitstellungsentgelt: Höchstbetrag 60 € je Wohnung und Jahr |
| §§ 7, 8 HeizkostenV | 50–70 % der Heiz-/Warmwasserkosten nach Verbrauch, Rest nach Fläche |
| § 9 Abs. 2 HeizkostenV | Vorwegabzug des Warmwasseranteils bei verbundenen Anlagen |
| § 12 Abs. 1 HeizkostenV | 15 % Kürzung ohne verbrauchsabhängige Abrechnung |
| § 6a HeizkostenV | Hinweis auf unterjährige Verbrauchsinformation |
| § 35a EStG | Ausweis der anteiligen Arbeitskosten für die Steuererklärung des Mieters |

Nach ständiger Rechtsprechung des BGH muss eine Betriebskostenabrechnung
mindestens enthalten: eine **Zusammenstellung der Gesamtkosten**, die **Angabe und
Erläuterung des Verteilerschlüssels**, die **Berechnung des Anteils des Mieters**
und den **Abzug der geleisteten Vorauszahlungen**. Alle vier Bestandteile erzeugt
die Anwendung für jedes Mietverhältnis.

## Funktionsumfang

**Erfassung**

- Vermieter, Objekt und Einheiten (Wohnfläche, Lage, Miteigentumsanteil, Gewerbe)
- Mietverhältnisse mit taggenauen Zeiträumen, mehreren Mietern, abweichender
  Zustellanschrift und wechselnder Personenzahl (Personentage)
- Kostenpositionen aus dem BetrKV-Katalog mit Beleg, Verteilerschlüssel und
  **Vorwegabzug** für nicht umlagefähige Bestandteile
- Nicht umlagefähige Kosten als eigene Kategorie
- Zählerstände bzw. Verbräuche je Mietverhältnis, Leerstandsverbrauch je Einheit
- Heizkosteneinstellungen nach HeizkostenV

**Verteilerschlüssel**

Wohnfläche · Personenzahl (zeitgewichtet) · Wohneinheiten · erfasster Verbrauch ·
Miteigentumsanteil · Direktzuordnung · HeizkostenV

**Berechnung**

- Taggenaue zeitanteilige Umlage bei Mieterwechsel und unterjährigem Ein-/Auszug
- Leerstandsanteile verbleiben beim Vermieter und werden gesondert ausgewiesen
- Verlustfreie Cent-Verteilung nach dem Verfahren des größten Rests: die Summe
  aller Einzelanteile entspricht exakt den Gesamtkosten
- Heizkosten: Vorwegabzug des Warmwasseranteils, Trennung in Grund- und
  Verbrauchskosten, 15-%-Kürzung bei fehlender Verbrauchserfassung

**Ausgabe**

- Druckfertiger Abrechnungsbogen je Mietverhältnis (über die Druckfunktion des
  Browsers als PDF speicherbar) mit Briefkopf, Stammdaten, Kostentabellen,
  Abrechnungsergebnis, Zahlungsaufforderung bzw. Guthabenerstattung
- Erläuterung jedes verwendeten Verteilerschlüssels
- Anlage 1: Gesamtkosten des Objekts inklusive Vorwegabzügen
- Anlage 2: nicht umlagefähige Kosten (Transparenz, nicht in Rechnung gestellt)
- Bescheinigung nach § 35a EStG
- Rechtliche Hinweise zu Belegeinsicht, Einwendungs- und Abrechnungsfrist

**Prüfung**

Über 25 automatische Prüfungen, gestuft nach Fehler, Warnung und Hinweis – von der
fehlenden Umlagevereinbarung über unzulässige Verbrauchsanteile bis zur
rechnerischen Konsistenz der Verteilung.

## Datenhaltung

Alle Daten bleiben ausschließlich im Browser (`localStorage`). Es findet keine
Übertragung an einen Server statt. Über **Exportieren** und **Importieren** lassen
sich die Daten als JSON sichern und auf andere Geräte übertragen.

## Aufbau

```
src/
  domain/                 Fachlogik, frei von UI – vollständig getestet
    types.ts              Datenmodell (Geldbeträge durchgängig in Cent)
    katalog.ts            Kostenartenkatalog § 2 BetrKV und nicht umlagefähige Kosten
    util.ts               Datums-, Geld- und Verteilungsfunktionen
    heizkosten.ts         HeizkostenV: Warmwasseranteil, Grund-/Verbrauchskosten
    berechnung.ts         Umlagemaßstäbe, Verteilung, Abrechnung je Mietverhältnis
    pruefung.ts           Formelle und materielle Prüfung
  state/                  Zustandsverwaltung, Persistenz, Beispieldaten
  components/             Erfassungsmasken, Prüfbericht, Abrechnungsbogen
```

Die Fachlogik ist vollständig von der Oberfläche getrennt und mit 81 Tests
abgedeckt (`npm test`), unter anderem für die verlustfreie Verteilung, die
zeitanteilige Umlage bei Mieterwechsel, die Heizkostenaufteilung nach
§ 9 HeizkostenV und sämtliche Prüfregeln.

## Hinweise zur Anwendung

- **Abflussprinzip oder Leistungsprinzip:** Die Anwendung rechnet mit den erfassten
  Beträgen. Welche Rechnungen in den Zeitraum gehören, entscheiden Sie bei der
  Erfassung; ein Belegdatum außerhalb des Zeitraums wird als Hinweis angezeigt.
- **Mieterwechsel:** Legen Sie für dieselbe Einheit zwei Mietverhältnisse mit den
  jeweiligen Zeiträumen an. Verbrauchsabhängige Kosten setzen eine Zwischenablesung
  voraus – erfassen Sie die Werte getrennt je Mietverhältnis.
- **Gewerbeeinheiten:** Führt gewerbliche Nutzung zu erheblich höheren Kosten, ist
  vor der Umlage ein Vorwegabzug vorzunehmen (Feld „Vorwegabzug“ der jeweiligen
  Kostenposition).

## Haftungsausschluss

Diese Anwendung unterstützt bei der Erstellung von Betriebskostenabrechnungen und
bildet die einschlägigen Vorschriften ab. Sie ersetzt keine Rechtsberatung. Die
Verantwortung für die inhaltliche Richtigkeit der erfassten Daten und der erteilten
Abrechnung liegt beim Anwender.

## Lizenz

MIT
