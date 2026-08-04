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

Sie verwaltet dabei **mehrere Vermieter mit mehreren Objekten**: dich privat
mit deinen beiden Immobilien und daneben die GbR mit ihren Mietobjekten.
Abgerechnet wird immer je Objekt, die Daten der Objekte bleiben getrennt.

Technisch ist es eine **Web-App (PWA)**: HTML, CSS und ES-Module, kein
Build-Schritt, keine Abhängigkeiten. Auf dem iPad wird sie über
*Safari → Teilen → Zum Home-Bildschirm* installiert und läuft danach im
Vollbild wie eine normale App – ohne Safari-Leiste und ohne
Internetverbindung. Alle Daten bleiben auf dem Gerät.

> **Du hast nur ein iPad und keinen Mac?** Kein Problem – die Einrichtung läuft
> komplett im Browser, ohne Terminal. Alles dazu in
> **[ANLEITUNG-NUR-IPAD.md](ANLEITUNG-NUR-IPAD.md)**. Die Schritte unten
> kannst du dann überspringen.

---

## Schritt 1 – Code auf den Mac holen

Terminal öffnen (⌘ Leertaste → „Terminal“):

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

## Schritt 2 – App bereitstellen

Ausführlich: **[ANLEITUNG-WEB.md](ANLEITUNG-WEB.md)**

### 2a. Auf dem Mac starten

```bash
npm start
```

Der Server zeigt zwei Adressen an: eine für den Mac, eine fürs iPad im WLAN.
Die erste im Browser öffnen – fertig. Beenden mit **Strg + C**.

### 2b. Vom iPad aus öffnen

Die angezeigte WLAN-Adresse (etwa `http://192.168.1.42:8080`) in **Safari** auf
dem iPad eingeben, dann **Teilen → Zum Home-Bildschirm**.

Gut zum Ausprobieren. Der Mac muss dabei laufen, und offline funktioniert die
App so noch nicht.

### 2c. Dauerhafte Adresse einrichten

Damit läuft alles ohne Mac und offline:

1. Ordner `Spachmann` im Finder öffnen
2. <https://app.netlify.com/drop> aufrufen
3. Den **Ordner** ins Fenster ziehen
4. Kostenloses Konto anlegen, damit die Adresse bestehen bleibt
5. Adresse in Safari öffnen → **Teilen → Zum Home-Bildschirm**

Alternative über GitHub Pages samt Fallstricken: siehe
[ANLEITUNG-WEB.md](ANLEITUNG-WEB.md).

---

## Schritt 3 – Die App benutzen

Zum Kennenlernen: **Daten & Sicherung → Beispieldaten laden** – danach zeigen
alle Bereiche ein vollständiges Portfolio: zwei privat gehaltene Immobilien und
eine GbR mit zwei weiteren Objekten, mit Mieterwechsel, Heizkosten und
CO₂-Aufteilung. Das dritte Objekt zeigt eine Hybridanlage aus Wärmepumpe und
Gas-Brennwertkessel mit je eigenem Wärmemengenzähler.

Für die eigene Abrechnung in dieser Reihenfolge:

1. **Vermieter** – dich selbst und, falls vorhanden, die GbR anlegen.
   Bei einer GbR gehört unter *Vertreten durch* hinein, wer sie vertritt.
2. **Objekte** – jede Immobilie anlegen und dem richtigen Vermieter zuordnen
3. **Wohneinheiten** – jede Einheit mit Wohnfläche, auch leerstehende
4. **Mietverhältnisse** – Mieter, Zeiträume, Personen, Vorauszahlungen
5. **Daten & Sicherung** – Abrechnungszeitraum anlegen, etwa 2024
6. **Kosten** – jede Rechnung als Position, Kostenart aus dem Katalog wählen
7. **Heizung & Warmwasser** – falls zentral geheizt wird. Lege je Wärmeerzeuger
   einen Eintrag an; eine Hybridanlage aus Gas und Wärmepumpe bekommt also zwei
8. **Verbräuche** – Zählerstände eintragen
9. **Rechtsprüfung** – Fehler und Warnungen abarbeiten
10. **Dokument** – Vorschau prüfen und PDF erzeugen

Die Schritte 3 bis 10 gelten **je Objekt**. Welches Objekt gemeint ist, wählst
du oben in der Seitenleiste – dort stehen alle Objekte, nach Vermieter
gruppiert. Für das zweite Haus und für jedes Objekt der GbR wiederholst du die
Schritte also einmal; die Daten bleiben sauber getrennt.

Im Bereich **Dokument** schaltest du oben um zwischen allen Mieterabrechnungen,
einer einzelnen Abrechnung und der **internen Kostenübersicht**, die
umlagefähige und nicht umlagefähige Kosten gegenüberstellt. Die interne
Übersicht ist ausdrücklich nicht für Mieter bestimmt.

### PDF erzeugen

1. Im Bereich **Dokument** auf *Drucken / als PDF sichern* tippen
2. Im iOS-Druckdialog die Seitenvorschau **mit zwei Fingern aufziehen**
3. Oben rechts *Teilen → In Dateien sichern*

Das ergibt eine PDF-Datei im A4-Format, die du per Mail versenden oder
ausdrucken kannst.

### Sicherungen anlegen

**Daten & Sicherung → Sicherung speichern**. Auf dem iPad öffnet iOS das
Teilen-Menü – dort **In Dateien sichern** wählen und den Ordner bestimmen,
etwa iCloud Drive. Einen eigenen Speicherdialog gibt es in Safari nicht.
Voraussetzung ist eine `https://`-Adresse; über die WLAN-Adresse aus Schritt 2a
fehlt das Teilen-Menü.

Der Grund, warum das zählt: Die Daten liegen im Speicher von Safari, und der
hängt an der Adresse. Wer von der WLAN-Adresse auf eine feste Web-Adresse
wechselt, muss die Daten über eine Sicherung mitnehmen. Auch beim Löschen der
Safari-Daten oder beim Zurücksetzen des Geräts sind sie sonst weg.

---

## Alle Dokumente

| Datei | Inhalt |
| --- | --- |
| [START.md](START.md) | diese Übersicht |
| [ANLEITUNG-NUR-IPAD.md](ANLEITUNG-NUR-IPAD.md) | ohne Mac: App im Browser einrichten, alles vom iPad aus |
| [ANLEITUNG-WEB.md](ANLEITUNG-WEB.md) | mit Mac: drei Wege zur laufenden App, Home-Bildschirm, PDF, Fehlerbehebung |
| [README.md](README.md) | fachliche Beschreibung: Rechtsgrundlagen, Verteilerschlüssel, Rechtsprüfung, Aufbau des Dokuments |

---

## Ein Hinweis zum Schluss

**Zum Recht:** Die App setzt §§ 556, 556a BGB, die Betriebskostenverordnung,
die Heizkostenverordnung und das Kohlendioxidkostenaufteilungsgesetz um und
prüft typische Fehlerquellen automatisch. Ob eine Kostenart im konkreten Fall
umgelegt werden darf, richtet sich aber **immer zusätzlich nach dem
Mietvertrag** – die Umlage muss dort wirksam vereinbart sein. Die Prüfung
ersetzt keine Rechtsberatung im Einzelfall.
