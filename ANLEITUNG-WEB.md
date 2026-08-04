# Die Web-App auf dem iPad nutzen

Die App braucht keine Installation aus dem App Store – nur eine Adresse, die
du in Safari öffnen kannst. Danach legst du sie auf den Home-Bildschirm und sie
verhält sich wie eine normale App: eigenes Symbol, Vollbild ohne Safari-Leiste,
Daten bleiben auf dem Gerät.

> **Ohne Mac?** Dann brauchst du diese Seite nicht – die Einrichtung läuft
> komplett im Browser auf dem iPad:
> [ANLEITUNG-NUR-IPAD.md](ANLEITUNG-NUR-IPAD.md)

Es gibt drei Wege dorthin. Fang mit Weg 1 an, um zu sehen, ob dir die App
gefällt; für den Alltag ist Weg 3 der bequemste.

| | Aufwand | iPad ohne Mac nutzbar | Offline |
| --- | --- | --- | --- |
| **1. Auf dem Mac ausprobieren** | eine Minute | nein | ja |
| **2. Vom iPad, Mac läuft mit** | zwei Minuten | nein, Mac muss an sein | nein |
| **3. Eigene Web-Adresse** | zehn Minuten, einmalig | ja | ja |

---

## Weg 1 – Auf dem Mac ausprobieren

Terminal öffnen (⌘ Leertaste → „Terminal“):

```bash
git clone https://github.com/Spachmann/Spachmann.git
cd Spachmann
git checkout claude/nebenkosten-abrechnung-app-pl34dv
npm start
```

Der Server meldet sich mit zwei Adressen. Die erste im Browser öffnen:

```
http://localhost:8080
```

Beenden mit **Strg + C** im Terminal.

Zum Ausprobieren links **Daten & Sicherung → Beispieldaten laden** antippen –
danach zeigen alle Bereiche ein vollständiges Mehrfamilienhaus mit
Mieterwechsel, Heizkosten und CO₂-Aufteilung.

---

## Weg 2 – Vom iPad aus, während der Mac läuft

Beim Start zeigt der Server auch die Adresse im lokalen Netz an, etwa:

```
  Auf dem iPad im selben WLAN:
      http://192.168.1.42:8080
```

Diese Adresse in **Safari auf dem iPad** eingeben (Mac und iPad müssen im
selben WLAN sein). Dann **Teilen → Zum Home-Bildschirm**.

Gut zum Testen auf dem echten Gerät. Für den Alltag hat der Weg zwei Haken:
Der Mac muss laufen, und weil die Verbindung unverschlüsselt ist (`http://`),
richtet Safari keinen Offline-Speicher ein – ohne laufenden Mac ist die App
also nicht erreichbar.

---

## Weg 3 – Eigene Web-Adresse (empfohlen)

Damit läuft die App unabhängig vom Mac, offline und dauerhaft. Du brauchst
einen Ort, der die Dateien über **HTTPS** ausliefert.

### 3a. Netlify Drop – der schnellste Weg

Kein Kommandozeilenwissen nötig, keine Konfiguration.

1. Auf dem Mac den geklonten Ordner `Spachmann` im Finder öffnen.
2. Im Browser **<https://app.netlify.com/drop>** aufrufen.
3. Den **Ordner** `Spachmann` in das Fenster ziehen.
4. Nach wenigen Sekunden erscheint eine Adresse wie
   `https://zufallsname-123456.netlify.app`.
5. Kostenloses Konto anlegen, damit die Seite dauerhaft bestehen bleibt – ohne
   Anmeldung verfällt sie wieder. Unter *Site configuration → Change site name*
   lässt sich die Adresse in etwas Merkbares ändern.

Diese Adresse in Safari auf dem iPad öffnen → **Teilen → Zum Home-Bildschirm**.

> Die Seite ist über die Adresse öffentlich erreichbar, aber sie enthält nur
> das Programm. **Deine erfassten Daten liegen ausschließlich auf deinem iPad**
> und werden nie übertragen – die App hat kein Backend.

### 3b. GitHub Pages – Alternative

Wenn du ohnehin GitHub nutzt: *Repository → Settings → Pages → Source:
„Deploy from a branch“*, als Branch `claude/nebenkosten-abrechnung-app-pl34dv`
und als Ordner `/ (root)` wählen. Nach ein paar Minuten ist die App unter der
angezeigten Adresse erreichbar.

**Zwei Dinge vorher bedenken:**

* `Spachmann/Spachmann` ist dein Profil-Repository. Aktivierst du Pages dort,
  belegt die App die Adresse `https://spachmann.github.io/` – falls du dort
  bereits eine persönliche Seite hast, wird sie ersetzt. Sauberer ist ein
  eigenes Repository, zum Beispiel `nebenkosten`; dann liegt die App unter
  `https://spachmann.github.io/nebenkosten/`.
* Für private Repositories setzt GitHub Pages ein kostenpflichtiges Konto
  voraus.

---

## Auf den Home-Bildschirm legen

In **Safari** (nicht Chrome – dort fehlt die Funktion):

1. Adresse öffnen
2. Unten bzw. oben rechts auf **Teilen** (Quadrat mit Pfeil nach oben)
3. **Zum Home-Bildschirm** wählen
4. Namen bestätigen, zum Beispiel „Nebenkosten“

Danach startet die App über ihr eigenes Symbol im Vollbild, ohne Adresszeile.

---

## Erste Schritte in der App

Empfohlene Reihenfolge:

1. **Vermieter** – dich selbst anlegen; eine GbR zusätzlich mit Rechtsform
   *GbR* und dem Feld *Vertreten durch*
2. **Objekte** – jede Immobilie anlegen und dem richtigen Vermieter zuordnen
3. **Wohneinheiten** – jede Einheit mit Wohnfläche, auch leerstehende
4. **Mietverhältnisse** – Mieter, Zeiträume, Personen, Vorauszahlungen
5. **Daten & Sicherung** – Abrechnungszeitraum anlegen, etwa 2024
6. **Kosten** – jede Rechnung als Position, Kostenart aus dem Katalog wählen
7. **Heizung & Warmwasser** – falls zentral geheizt wird, je Wärmeerzeuger ein Eintrag
8. **Verbräuche** – Zählerstände
9. **Rechtsprüfung** – Fehler und Warnungen abarbeiten
10. **Dokument** – Vorschau ansehen und drucken

Ab Schritt 3 arbeitest du immer in **einem** Objekt. Welches das ist, wählst du
oben in der Seitenleiste; dort stehen alle Objekte, nach Vermieter gruppiert.
Für jedes weitere Objekt wiederholst du die Schritte 3 bis 10.

Unter **Dokument** kannst du oben umschalten zwischen allen Mieterabrechnungen,
einer einzelnen Abrechnung und der internen Kostenübersicht, die umlagefähige
und nicht umlagefähige Kosten gegenüberstellt. Die interne Übersicht ist
ausdrücklich nicht für Mieter bestimmt.

### PDF erzeugen

1. Im Bereich **Dokument** auf **Drucken / als PDF sichern** tippen
2. Im iOS-Druckdialog die Seitenvorschau **mit zwei Fingern aufziehen**
3. Oben rechts **Teilen → In Dateien sichern** – fertig ist die PDF-Datei im
   A4-Format

Über *Teilen* lässt sie sich auch direkt per E-Mail an den Mieter senden.

---

## Wichtig: Sicherungen anlegen

Die Daten liegen im Speicher des Browsers. Der ist an die Adresse gebunden und
kann vom System oder beim Löschen der Safari-Daten geleert werden. Deshalb:

**Daten & Sicherung → Sicherung speichern**. Auf dem iPad öffnet sich das
**Teilen-Menü**; dort **In Dateien sichern** wählen und den Ordner bestimmen.
Einen Speicherdialog wie am Rechner kennt Safari nicht – der Weg zum
Speicherort führt immer über das Teilen-Menü. Über **Sicherung laden** ist die
Datei jederzeit wieder da.

Das Teilen-Menü setzt eine `https://`-Adresse voraus. Über die WLAN-Adresse aus
Weg 2 (`http://192.168.…`) steht es nicht zur Verfügung, und Safari bietet dort
auch keinen Download an. Zum dauerhaften Arbeiten ist Weg 3 deshalb ohnehin die
bessere Wahl; als Notlösung öffnet **Sicherung anzeigen** die Daten in einem
neuen Tab.

Der Fall, in dem das wirklich zählt: **Adresswechsel.** Wechselst du von der
WLAN-Adresse aus Weg 2 auf eine eigene Web-Adresse aus Weg 3, sind das für
Safari zwei verschiedene Seiten – die Daten wandern **nicht** automatisch mit.
Vorher Sicherung speichern, nachher laden. Dasselbe gilt beim Wechsel auf ein
anderes iPad.

---

## Wenn etwas klemmt

| Beobachtung | Ursache und Abhilfe |
| --- | --- |
| `command not found: npm` | Node.js installieren: <https://nodejs.org> (LTS-Version) |
| `command not found: git` | macOS bietet die Entwicklerwerkzeuge zur Installation an – bestätigen und Befehl wiederholen |
| `EADDRINUSE` beim Start | Port belegt, anderen wählen: `node tools/serve.js 3000` |
| iPad erreicht die Adresse nicht | Beide Geräte im selben WLAN? Manche Gastnetze trennen Geräte voneinander |
| Seite bleibt weiß | Adresse mit `http://` davor eingeben und prüfen, ob der Server im Terminal noch läuft |
| „Zum Home-Bildschirm“ fehlt | Nur Safari bietet das an, nicht Chrome oder Firefox |
| Daten plötzlich weg | Safari-Daten wurden geleert – Sicherung über *Daten & Sicherung* laden |

Fachliche Fragen zur Abrechnung selbst beantwortet [README.md](README.md).
