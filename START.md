# Start – alle Schritte auf einen Blick

Diese Seite ist der Einstieg. Sie fasst zusammen, was es gibt, welchen Weg du
gehen willst und was dabei zu tun ist. Die Einzelheiten stehen in den verlinkten
Anleitungen.

---

## Was du bekommen hast

Eine App zur **Nebenkostenabrechnung für Mieter** nach deutschem Recht. Sie
trennt umlagefähige von nicht umlagefähigen Kosten, rechnet bei Mieterwechsel
tagegenau ab und erzeugt ein druckfertiges A4-Dokument mit allen Angaben, die
der Bundesgerichtshof verlangt.

Es gibt sie in **zwei Fassungen**, die fachlich identisch rechnen:

| | **Web-App** | **Native App** |
| --- | --- | --- |
| Wo | Wurzelverzeichnis | Ordner `ios/` |
| Was du brauchst | nur eine Web-Adresse | Mac mit Xcode |
| Einrichtung | 1 bis 10 Minuten | etwa 20 Minuten |
| Läuft dauerhaft | ja | mit kostenlosem Apple-Konto: 7 Tage, dann ⌘R |
| PDF | über den iOS-Druckdialog | direkt, dazu Teilen und AirPrint |

**Empfehlung:** Fang mit der Web-App an. Sie ist schneller eingerichtet und
läuft ohne Ablauffrist. Die native Fassung lohnt sich, wenn dir der direkte
PDF-Export und AirPrint wichtig sind.

---

## Schritt 1 – Code auf den Mac holen

Gilt für beide Fassungen. Terminal öffnen (⌘ Leertaste → „Terminal“):

```bash
git clone https://github.com/Spachmann/Spachmann.git
cd Spachmann
git checkout claude/nebenkosten-abrechnung-app-pl34dv
```

> Fragt macOS nach den Entwicklerwerkzeugen, bestätigen und den Befehl
> wiederholen. Ohne Terminal geht es auch über *Code → Download ZIP* auf GitHub,
> nachdem du oben links den Zweig `claude/nebenkosten-abrechnung-app-pl34dv`
> ausgewählt hast.

---

## Weg A – Web-App

Ausführlich: **[ANLEITUNG-WEB.md](ANLEITUNG-WEB.md)**

### A1. Auf dem Mac starten

```bash
npm start
```

Der Server zeigt zwei Adressen an: eine für den Mac, eine fürs iPad im WLAN.
Die erste im Browser öffnen – fertig. Beenden mit **Strg + C**.

### A2. Vom iPad aus öffnen

Die angezeigte WLAN-Adresse (etwa `http://192.168.1.42:8080`) in **Safari** auf
dem iPad eingeben, dann **Teilen → Zum Home-Bildschirm**.

Gut zum Ausprobieren. Der Mac muss dabei laufen, und offline funktioniert die
App so noch nicht.

### A3. Dauerhafte Adresse einrichten

Damit läuft alles ohne Mac und offline:

1. Ordner `Spachmann` im Finder öffnen
2. <https://app.netlify.com/drop> aufrufen
3. Den **Ordner** ins Fenster ziehen
4. Kostenloses Konto anlegen, damit die Adresse bestehen bleibt
5. Adresse in Safari öffnen → **Teilen → Zum Home-Bildschirm**

Alternative über GitHub Pages samt Fallstricken: siehe
[ANLEITUNG-WEB.md](ANLEITUNG-WEB.md).

---

## Weg B – Native App

Ausführlich: **[ios/ANLEITUNG.md](ios/ANLEITUNG.md)**

### B1. Rechenkern prüfen

```bash
cd ios
swift test
```

Erwartet: `Executed 61 tests, with 0 failures`.

Dieser Schritt ist wichtig – der Swift-Code entstand ohne verfügbaren
Swift-Compiler und wurde daher nie übersetzt. Kommen Fehler, schick mir die
Ausgabe, dann behebe ich sie.

### B2. Im Simulator ansehen

```bash
open Nebenkosten.xcodeproj
```

Oben in der Symbolleiste als Ziel ein **iPad Pro** unter *iOS Simulators*
wählen, dann **⌘R**. Ohne Signierung, nur zum Anschauen.

### B3. Auf dem iPad installieren

1. *Xcode → Einstellungen → Accounts → „+“* → Apple-ID (kostenlos genügt)
2. Links auf **Nebenkosten** → TARGETS **Nebenkosten** → Reiter
   **Signing & Capabilities** → *Automatically manage signing* anhaken →
   bei **Team** deine Apple-ID
3. iPad anschließen, entsperren, „Diesem Computer vertrauen“
4. Oben als Ziel dein iPad wählen, **⌘R**
5. Auf dem iPad: *Einstellungen → Allgemein → VPN & Geräteverwaltung →
   Entwickler-App → Vertrauen*, dann nochmal **⌘R**

---

## Schritt 2 – Die App benutzen

Gilt für beide Fassungen. Zum Kennenlernen:
**Daten & Sicherung → Beispieldaten laden** – danach zeigen alle Bereiche ein
vollständiges Mehrfamilienhaus mit Mieterwechsel, Heizkosten und
CO₂-Aufteilung.

Für die eigene Abrechnung in dieser Reihenfolge:

1. **Stammdaten** – Vermieter und Objekt
2. **Wohneinheiten** – jede Einheit mit Wohnfläche, auch leerstehende
3. **Mietverhältnisse** – Mieter, Zeiträume, Personen, Vorauszahlungen
4. **Daten & Sicherung** – Abrechnungszeitraum anlegen, etwa 2024
5. **Kosten** – jede Rechnung als Position, Kostenart aus dem Katalog wählen
6. **Heizung & Warmwasser** – falls zentral geheizt wird
7. **Verbräuche** – Zählerstände eintragen
8. **Rechtsprüfung** – Fehler und Warnungen abarbeiten
9. **Dokument** – Vorschau prüfen und PDF erzeugen

Im Bereich **Dokument** schaltest du oben um zwischen allen Mieterabrechnungen,
einer einzelnen Abrechnung und der **internen Kostenübersicht**, die
umlagefähige und nicht umlagefähige Kosten gegenüberstellt. Die interne
Übersicht ist ausdrücklich nicht für Mieter bestimmt.

### PDF erzeugen

* **Web-App:** *Drucken / als PDF sichern* → im iOS-Druckdialog die Vorschau
  mit zwei Fingern aufziehen → *Teilen → In Dateien sichern*
* **Native App:** *PDF erstellen* → dann *Teilen* oder *Drucken*

### Sicherungen anlegen

**Daten & Sicherung → Sicherung speichern**, Datei in *Dateien* oder iCloud
ablegen. Beide Fassungen lesen dasselbe Format.

Zwei Fälle, in denen das zählt:

* **Adresswechsel bei der Web-App.** Der Speicher hängt an der Adresse. Wer von
  der WLAN-Adresse auf eine feste Web-Adresse wechselt, muss die Daten über
  eine Sicherung mitnehmen.
* **Wechsel zwischen den Fassungen.** Sicherung aus der Web-App exportieren und
  in der nativen App laden – oder umgekehrt.

---

## Alle Dokumente

| Datei | Inhalt |
| --- | --- |
| [START.md](START.md) | diese Übersicht |
| [ANLEITUNG-WEB.md](ANLEITUNG-WEB.md) | Web-App: drei Wege zur laufenden App, Home-Bildschirm, PDF, Fehlerbehebung |
| [ios/ANLEITUNG.md](ios/ANLEITUNG.md) | Native App: von Xcode bis zur signierten App auf dem iPad |
| [README.md](README.md) | fachliche Beschreibung: Rechtsgrundlagen, Verteilerschlüssel, Rechtsprüfung, Aufbau des Dokuments |
| [ios/README.md](ios/README.md) | Aufbau des Swift-Projekts, Rechenkern, Projektgenerator |

---

## Zwei Hinweise zum Schluss

**Zur nativen Fassung:** Der Swift-Code wurde in einer Umgebung ohne
Swift-Compiler geschrieben und ist deshalb nie übersetzt worden. Die
Rechenlogik ist über 61 Tests gegen die geprüfte Web-Fassung abgesichert, aber
`swift test` ist der erste Schritt, bevor du Zeit in die Oberfläche steckst.

**Zum Recht:** Die App setzt §§ 556, 556a BGB, die Betriebskostenverordnung,
die Heizkostenverordnung und das Kohlendioxidkostenaufteilungsgesetz um und
prüft typische Fehlerquellen automatisch. Ob eine Kostenart im konkreten Fall
umgelegt werden darf, richtet sich aber **immer zusätzlich nach dem
Mietvertrag** – die Umlage muss dort wirksam vereinbart sein. Die Prüfung
ersetzt keine Rechtsberatung im Einzelfall.
