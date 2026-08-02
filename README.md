# Nebenkostenabrechnung

iPad-App zur Erfassung von Betriebskosten und Erstellung rechtskonformer
Nebenkostenabrechnungen für Mieter.

Die App trennt umlagefähige von nicht umlagefähigen Kosten, rechnet tagegenau
bei Mieterwechsel und Leerstand ab, wendet die Heizkostenverordnung und die
CO₂-Kostenaufteilung an und erzeugt ein druckfertiges A4-Dokument, das die vom
BGH geforderten formellen Mindestangaben enthält.

Alle Daten bleiben auf dem Gerät. Es gibt kein Backend und keine Übertragung an
Server.

## Zwei Fassungen

| | Web-App (dieses Verzeichnis) | Native App (`ios/`) |
| --- | --- | --- |
| Technik | HTML, CSS, ES-Module – kein Build-Schritt | SwiftUI, Xcode-Projekt |
| Installation | Safari → Teilen → Zum Home-Bildschirm | Xcode → ⌘R |
| PDF | über den iOS-Druckdialog | direkt über `UIPrintPageRenderer`, dazu Teilen und AirPrint |
| Ablage | Browserspeicher des Geräts | Dateisystem der App |
| Rechenkern | `src/core/` | `ios/Nebenkosten/Kern/` |

Beide benutzen dasselbe Sicherungsformat, Daten lassen sich also austauschen.
Die Einrichtung der nativen Fassung beschreibt [`ios/README.md`](ios/README.md).

---

## Installation auf dem iPad

Die App ist eine installierbare Web-App (PWA) ohne Build-Schritt.

1. Dateien auf einen Webserver legen, der über **HTTPS** erreichbar ist
   (oder lokal testen, siehe unten). HTTPS bzw. `localhost` ist Voraussetzung
   dafür, dass Safari den Service Worker und die Installation zulässt.
2. Die Adresse in **Safari** auf dem iPad öffnen.
3. **Teilen → Zum Home-Bildschirm** wählen.

Danach startet die App im Vollbild ohne Safari-Leiste, funktioniert offline und
speichert die Daten lokal auf dem Gerät.

### Lokal ausprobieren

```bash
npm start                 # http://localhost:8080
node tools/serve.js 3000  # anderer Port
```

### Als PDF sichern

Im Reiter **Dokument** auf *Drucken / als PDF sichern* tippen. Im iOS-Druckdialog
die Vorschau mit zwei Fingern aufziehen und **In Dateien sichern** wählen – das
ergibt eine PDF-Datei im A4-Format. Über *Teilen* lässt sie sich direkt per
E-Mail versenden.

---

## Was die App abdeckt

### Trennung umlagefähig / nicht umlagefähig

Jede Kostenposition wird einer Kostenart zugeordnet:

* **Umlagefähig** sind ausschließlich die 17 Kostenarten des Katalogs in
  **§ 2 BetrKV**. Die App kennt sie vollständig samt Rechtsgrundlage,
  Standard-Verteilerschlüssel und den typischen Fallstricken.
* **Nicht umlagefähig** sind insbesondere Verwaltungskosten und Kosten der
  Instandhaltung und Instandsetzung (**§ 1 Abs. 2 BetrKV**). Sie werden
  miterfasst, erscheinen aber ausschließlich in der internen Vermieterübersicht
  und können den Mieter nie erreichen.
* **Teilweise umlagefähige Positionen** – etwa Hauswartkosten mit einem Anteil
  für Instandhaltung und Verwaltung – lassen sich mit einem begründeten Abzug
  erfassen. Der Abzug wird in der Mieterabrechnung offen ausgewiesen.

Zwei Beispiele, die die App gesondert behandelt:

* **Sonstige Betriebskosten (§ 2 Nr. 17 BetrKV)** werden nur umgelegt, wenn die
  konkrete Kostenart im Mietvertrag ausdrücklich benannt ist. Ohne dieses
  Häkchen meldet die Prüfung einen Fehler (BGH VIII ZR 137/09).
* **Kabel-TV-Sammelverträge** sind seit dem Wegfall des Nebenkostenprivilegs zum
  30.06.2024 nicht mehr umlagefähig. Die App warnt für Zeiträume danach.

### Verteilerschlüssel

Wohnfläche (gesetzlicher Auffangschlüssel nach § 556a Abs. 1 Satz 1 BGB),
Personenzahl, Wohneinheiten, Miteigentumsanteile, erfasster Verbrauch und
Direktzuordnung. Nicht verbrauchsabhängige Kosten werden **tagegenau** auf den
Nutzungszeitraum umgerechnet.

Bei Wasser kann die Differenz zwischen Hauptzähler und Summe der Wohnungszähler
wahlweise anteilig umgelegt, nach Wohnfläche verteilt oder vom Vermieter
getragen werden. Wird sie verteilt, erscheint sie als **eigene Zeile** – damit
die Rechnung „Ihr Maßstab ÷ Gesamtmaßstab = Ihr Anteil" für den Mieter
nachprüfbar bleibt.

### Mieterwechsel und Leerstand

Der Abrechnungszeitraum wird je Einheit in Nutzungsabschnitte zerlegt. Lücken
zwischen zwei Mietverhältnissen gelten als Leerstand; die darauf entfallenden
Kosten bleiben beim Vermieter und werden nicht auf die übrigen Mieter verteilt.

### Heiz- und Warmwasserkosten (HeizkostenV)

* 50 bis 70 % nach erfasstem Verbrauch, der Rest nach Wohnfläche
  (§ 7 Abs. 1, § 8 Abs. 1 HeizkostenV) – Werte außerhalb dieses Rahmens meldet
  die Prüfung als Fehler.
* Verbundene Anlagen: Der Warmwasseranteil wird vorrangig aus der gemessenen
  Wärmemenge ermittelt, ersatzweise nach der Formel
  `Q = 2,5 · V · (tw − 10) / 1000` (§ 9 Abs. 2 HeizkostenV).
* Ohne Verbrauchserfassung wird der Anteil des Nutzers automatisch um 15 %
  gekürzt (§ 12 Abs. 1 HeizkostenV).
* Zwischenablesung bei Nutzerwechsel (§ 9b HeizkostenV) kann je Mietverhältnis
  erfasst werden; fehlt sie, wird der Verbrauch zeitanteilig geteilt und die
  Prüfung weist darauf hin.

### CO₂-Kostenaufteilung (CO2KostAufG, seit 01.01.2023)

Aus CO₂-Menge und Wohnfläche wird der Emissionskennwert (kg CO₂/m²·Jahr)
gebildet und daraus die Stufe des Zehn-Stufen-Modells der Anlage zu § 5 Abs. 1
CO2KostAufG. Der Vermieteranteil von 0 bis 95 % wird **vor** der Umlage von den
Brennstoffkosten abgezogen. Unterjährige Zeiträume werden für die Einstufung auf
ein Jahr hochgerechnet. Nichtwohngebäude werden hälftig geteilt (§ 8 Abs. 1),
die Ausnahme des § 9 lässt den Vermieteranteil entfallen.

### § 35a EStG

Lohn-, Maschinen- und Fahrtkostenanteile lassen sich je Position als
haushaltsnahe Dienstleistung oder Handwerkerleistung erfassen. In der
Mieterabrechnung erscheint eine Bescheinigung mit dem auf den Mieter
entfallenden Anteil.

### Automatische Rechtsprüfung

Der Reiter **Rechtsprüfung** prüft unter anderem:

| Prüfung | Grundlage |
| --- | --- |
| Abrechnungszeitraum höchstens zwölf Monate | § 556 Abs. 3 Satz 1 BGB |
| Zugang innerhalb der Abrechnungsfrist, sonst Ausschluss von Nachforderungen | § 556 Abs. 3 Satz 2 und 3 BGB |
| Vier formelle Mindestangaben vollständig | BGH VIII ZR 84/07 |
| Sonstige Betriebskosten im Mietvertrag benannt | § 2 Nr. 17 BetrKV |
| Hauswartkosten um Instandhaltungsanteil bereinigt | § 2 Nr. 14 BetrKV |
| Verbrauchsanteil Heizung/Warmwasser zwischen 50 und 70 % | §§ 7, 8 HeizkostenV |
| Warmwasseranteil bei verbundener Anlage ermittelt | § 9 Abs. 2 HeizkostenV |
| CO₂-Kosten aufgeteilt | §§ 5–7 CO2KostAufG |
| Zwischenablesung bei Nutzerwechsel | § 9b HeizkostenV |
| Vollständigkeit von Wohnflächen, Vorauszahlungen, Anschriften | § 556a BGB, § 259 BGB |

Befunde sind als **Fehler** (Abrechnung so nicht wirksam), **Warnung**
(rechtlich riskant) oder **Hinweis** eingestuft.

### Das erzeugte Dokument

Je Mietverhältnis entsteht ein A4-Dokument mit:

1. Anschriftenfeld, Objekt- und Einheitsdaten, Abrechnungs- und Nutzungszeitraum
2. Gesamtkosten je Kostenart mit Verteilerschlüssel, Gesamtmaßstab, eigenem
   Maßstab, Anteil in Prozent und Betrag
3. Heiz- und Warmwasserkosten mit Grund- und Verbrauchsanteil und offenem
   Ausweis des CO₂-Abzugs
4. Abrechnungsergebnis mit Abzug der Vorauszahlungen und Zahlungsfrist
5. Bescheinigung nach § 35a EStG
6. Erläuterung der verwendeten Verteilerschlüssel
7. Rechtliche Hinweise: Belegeinsicht, Einwendungsfrist, Wirtschaftlichkeitsgebot,
   Anpassung der Vorauszahlungen

Zusätzlich gibt es eine **interne Kostenübersicht** für den Vermieter, die
umlagefähige und nicht umlagefähige Kosten gegenüberstellt und die
Gesamtbelastung des Vermieters ausweist. Sie ist als nicht zur Weitergabe
bestimmt gekennzeichnet.

---

## Bedienung

| Reiter | Zweck |
| --- | --- |
| Übersicht | Kennzahlen und Ergebnis je Mietverhältnis |
| Kosten | Rechnungen erfassen, Kostenarten-Katalog nachschlagen |
| Heizung & Warmwasser | HeizkostenV-Parameter und CO₂-Aufteilung |
| Verbräuche | Zählerstände je Einheit bzw. je Nutzer |
| Rechtsprüfung | Fehler, Warnungen, Hinweise |
| Dokument | Vorschau und Druck der Abrechnungen |
| Stammdaten | Vermieter und Objekt |
| Wohneinheiten | Alle Einheiten des Objekts, auch leerstehende |
| Mietverhältnisse | Mieter, Zeiträume, Personen, Vorauszahlungen |
| Daten & Sicherung | Abrechnungsjahre, Export/Import, Beispieldaten |

Empfohlene Reihenfolge beim ersten Mal: Stammdaten → Wohneinheiten →
Mietverhältnisse → Abrechnungsjahr anlegen → Kosten → Heizung → Verbräuche →
Rechtsprüfung → Dokument.

Über **Daten & Sicherung → Beispieldaten laden** lässt sich ein vollständiges
Mehrfamilienhaus mit Mieterwechsel, Leerstand, Heizkosten und CO₂-Aufteilung
laden, um die App auszuprobieren.

**Sicherungen** regelmäßig anlegen: Die Daten liegen im lokalen Speicher des
Browsers. Werden Safari-Daten gelöscht oder das Gerät zurückgesetzt, sind sie
weg.

---

## Projektstruktur

```
index.html                  App-Gerüst
manifest.webmanifest        Web-App-Manifest
sw.js                       Service Worker (Offline-Betrieb)
styles/app.css              Oberfläche
styles/dokument.css         A4-Layout und Druck
icons/                      App-Symbole

src/core/                   Rechenkern, ohne DOM-Abhängigkeit
  money.js                  Cent-Arithmetik und Formatierung
  datum.js                  tagegenaue Zeitraumrechnung
  katalog.js                § 2 BetrKV und nicht umlagefähige Kostenarten
  heizkosten.js             HeizkostenV
  co2.js                    CO2KostAufG-Stufenmodell
  abrechnung.js             Nutzungszeiträume, Verteilung, Ergebnis
  pruefung.js               Rechts- und Plausibilitätsprüfung
  model.js                  Datenmodell, Migration, Beispieldaten

src/store.js                Speicherung im localStorage
src/ui/                     Ansichten und Dokumentgenerator
src/app.js                  Navigation, Datenbindung, Aktionen

tests/core.test.js          Tests des Rechenkerns
tools/serve.js              lokaler Server
tools/icons-erzeugen.js     Icons aus icons/icon.svg rendern
tools/oberflaeche-pruefen.js  Rauchtest aller Ansichten im Browser
```

Alle Geldbeträge werden intern als ganzzahlige **Cent** geführt, damit keine
Fließkomma-Rundungsfehler in die Abrechnung geraten.

## Entwicklung

```bash
npm test                        # Rechenkern (53 Tests, keine Abhängigkeiten)
node tools/oberflaeche-pruefen.js   # alle Ansichten im Browser laden
node tools/icons-erzeugen.js        # Icons neu rendern
```

Die App kommt ohne Abhängigkeiten, ohne Build-Schritt und ohne Framework aus –
`index.html` in einem statischen Verzeichnis genügt.

---

## Rechtlicher Hinweis

Die App unterstützt bei der Erstellung einer Betriebskostenabrechnung nach
§§ 556, 556a BGB, der Betriebskostenverordnung, der Heizkostenverordnung und dem
Kohlendioxidkostenaufteilungsgesetz. **Ob eine Kostenart im konkreten Fall
umgelegt werden darf, richtet sich stets zusätzlich nach dem Mietvertrag** – die
Umlage von Betriebskosten muss wirksam vereinbart sein. Die automatische Prüfung
deckt typische Fehlerquellen ab, ersetzt aber keine rechtliche Beratung im
Einzelfall.
