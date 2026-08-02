# Die App auf dem iPad starten

Schritt-für-Schritt-Anleitung für einen Mac mit Xcode. Rechne beim ersten Mal
mit etwa 20 Minuten, davon geht die meiste Zeit für Xcode-Downloads drauf.

Du brauchst:

* einen Mac mit **Xcode 15 oder neuer** (kostenlos im App Store)
* eine **Apple-ID** – ein kostenloses Konto genügt
* optional ein iPad mit Ladekabel; zum Ausprobieren reicht der Simulator

---

## 1. Code auf den Mac holen

Terminal öffnen (⌘ Leertaste → „Terminal“) und eingeben:

```bash
git clone https://github.com/Spachmann/Spachmann.git
cd Spachmann
git checkout claude/nebenkosten-abrechnung-app-pl34dv
```

> Falls `git` nicht gefunden wird, fragt macOS, ob es die Entwicklerwerkzeuge
> installieren soll – das bestätigen und den Befehl danach wiederholen.

Ohne Terminal geht es auch über die Weboberfläche: auf GitHub oben links den
Zweig `claude/nebenkosten-abrechnung-app-pl34dv` auswählen, dann
**Code → Download ZIP** und das Archiv entpacken.

---

## 2. Rechenkern prüfen

Dieser Schritt ist wichtig: Der Swift-Code wurde in einer Umgebung ohne
Swift-Compiler geschrieben. Der folgende Befehl übersetzt den gesamten
Rechenkern und vergleicht die Ergebnisse mit Referenzwerten – er zeigt also
sofort, ob alles stimmt. Xcode brauchst du dafür noch nicht.

```bash
cd ios
swift test
```

**Erwartet:** eine Liste von Tests und am Ende sinngemäß
`Executed 61 tests, with 0 failures`.

**Falls Fehler erscheinen:** kopiere die Ausgabe und schick sie mir – das sind
dann Übersetzungsfehler in der Portierung, die ich gezielt beheben kann. Die
Oberfläche musst du dafür nicht anfassen.

---

## 3. Projekt in Xcode öffnen

```bash
open Nebenkosten.xcodeproj
```

Beim ersten Start lädt Xcode gegebenenfalls noch Komponenten nach.

---

## 4. Erst im Simulator ausprobieren

Der schnellste Weg zu einem laufenden Bild – hier ist **keine Signierung**
nötig:

1. Oben in der Symbolleiste steht neben dem Projektnamen das Zielgerät.
   Dort anklicken und unter *iOS Simulators* ein **iPad Pro** wählen.
2. **⌘R** drücken.

Der Simulator startet und zeigt die App. Damit du sofort etwas siehst:
in der linken Spalte **Daten & Sicherung** öffnen und
**Beispieldaten laden** antippen. Danach zeigen alle Bereiche ein
vollständiges Mehrfamilienhaus mit Mieterwechsel, Heizkosten und
CO₂-Aufteilung.

---

## 5. Auf dem echten iPad installieren

### 5.1 Apple-ID in Xcode hinterlegen

*Xcode → Einstellungen → Accounts → „+“ → Apple ID* und anmelden. Ein
kostenloses Konto reicht aus.

### 5.2 Signierung einstellen

1. In der linken Seitenleiste ganz oben auf das blaue Projektsymbol
   **Nebenkosten** klicken.
2. In der Spalte daneben unter **TARGETS** ebenfalls **Nebenkosten** wählen.
3. Den Reiter **Signing & Capabilities** öffnen.
4. **Automatically manage signing** anhaken.
5. Bei **Team** deine Apple-ID auswählen.

Erscheint der Fehler *„The bundle identifier is not available“*, ist die
Kennung schon vergeben. Dann im Feld **Bundle Identifier** etwas Eigenes
eintragen, zum Beispiel `de.spachmann.nebenkosten2`.

### 5.3 iPad verbinden und starten

1. iPad per Kabel anschließen, entsperren und **„Diesem Computer vertrauen“**
   bestätigen.
2. Oben in der Symbolleiste als Zielgerät dein iPad wählen.
3. **⌘R** drücken.

### 5.4 Beim ersten Mal: App auf dem iPad freigeben

Xcode meldet, dass die App nicht gestartet werden kann. Auf dem iPad:

*Einstellungen → Allgemein → VPN & Geräteverwaltung → unter „Entwickler-App“
deine Apple-ID auswählen → Vertrauen*

Danach in Xcode noch einmal **⌘R**.

> **Hinweis zum kostenlosen Konto:** Damit signierte Apps laufen sieben Tage.
> Danach einfach wieder ⌘R drücken – die Daten bleiben dabei erhalten. Mit
> einem kostenpflichtigen Entwicklerkonto (99 €/Jahr) sind es zwölf Monate.

---

## 6. Erste Schritte in der App

Empfohlene Reihenfolge:

1. **Stammdaten** – Vermieter und Objekt erfassen
2. **Wohneinheiten** – jede Einheit mit Wohnfläche, auch leerstehende
3. **Mietverhältnisse** – Mieter, Zeiträume, Personen, Vorauszahlungen
4. **Daten & Sicherung** – Abrechnungszeitraum anlegen, etwa 2024
5. **Kosten** – jede Rechnung als Position, Kostenart aus dem Katalog wählen
6. **Heizung & Warmwasser** – falls zentral geheizt wird
7. **Verbräuche** – Zählerstände
8. **Rechtsprüfung** – Fehler und Warnungen abarbeiten
9. **Dokument** – Vorschau ansehen, **PDF erstellen**, dann **Teilen** oder
   **Drucken**

Unter **Dokument** kannst du oben umschalten zwischen allen Mieterabrechnungen,
einer einzelnen Abrechnung und der internen Kostenübersicht, die umlagefähige
und nicht umlagefähige Kosten gegenüberstellt. Die interne Übersicht ist
ausdrücklich nicht für Mieter bestimmt.

**Sicherungen** regelmäßig anlegen: *Daten & Sicherung → Sicherung erstellen →
Teilen* und in Dateien oder iCloud ablegen.

---

## Wenn etwas klemmt

| Meldung | Ursache und Abhilfe |
| --- | --- |
| `Signing for "Nebenkosten" requires a development team` | Schritt 5.2, Team auswählen |
| `The bundle identifier is not available` | Bundle Identifier ändern, siehe 5.2 |
| `Untrusted Developer` auf dem iPad | Schritt 5.4 |
| `Could not launch` nach sieben Tagen | erneut ⌘R, kostenloses Konto läuft wöchentlich ab |
| Übersetzungsfehler in Swift | Ausgabe von `swift test` bzw. den Fehlertext aus Xcode kopieren und mir schicken |

Reine Rechen- oder Darstellungsfragen zur Abrechnung selbst beantwortet
`../README.md`.
